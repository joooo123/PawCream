import crypto from 'node:crypto'
import { rateLimit } from 'express-rate-limit'
import {
  normalizeInviteCode, inviteCodeHash, normalizeEmail, validEmail, validOtp,
  otpHash, secureMatchHex, mailConfigured, sendVerificationMail,
} from './registrationMail.js'

const emailLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false })
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false })

function badInvitation(res) { return res.status(403).json({ error: '邀请码无效、已使用或已撤销' }) }
export function registerSignupRoutes(app, pool, bcrypt, secret, publicUser) {
  // No email can be sent or code leaked unless SMTP is explicitly configured.
  app.post('/api/auth/email-code', emailLimiter, async (req, res, next) => {
    const email = normalizeEmail(req.body?.email)
    const code = normalizeInviteCode(req.body?.inviteCode)
    if (!validEmail(email)) return res.status(400).json({ error: '请输入有效的邮箱' })
    if (!code) return badInvitation(res)
    if (!mailConfigured()) return res.status(503).json({ error: '邮箱验证服务尚未配置，请联系管理员' })
    const ih = inviteCodeHash(code)
    const db = await pool.connect().catch(next)
    if (!db) return
    let ch
    try {
      await db.query('BEGIN')
      const invite = await db.query(
        'SELECT id FROM registration_invites WHERE code_hash=$1 AND used_at IS NULL AND revoked_at IS NULL', [ih],
      )
      if (!invite.rows.length) { await db.query('ROLLBACK'); return badInvitation(res) }
      const existing = await db.query('SELECT 1 FROM users WHERE email=$1', [email])
      if (existing.rows.length) { await db.query('ROLLBACK'); return res.status(409).json({ error: '该邮箱已经注册过了' }) }
      const old = await db.query('SELECT sent_at,window_start,window_sends FROM registration_email_codes WHERE email=$1 FOR UPDATE', [email])
      const row = old.rows[0]
      const now = Date.now()
      const windowSends = row && now - new Date(row.window_start).getTime() < 3600000 ? row.window_sends : 0
      if (row && now - new Date(row.sent_at).getTime() < 60000) {
        await db.query('ROLLBACK')
        return res.status(429).json({ error: '发送过于频繁，请 60 秒后再试' })
      }
      if (windowSends >= 5) {
        await db.query('ROLLBACK')
        return res.status(429).json({ error: '这个邮箱一小时内发送次数已达上限' })
      }
      const otp = String(crypto.randomInt(100000, 1000000))
      ch = otpHash(secret, email, ih, otp)
      await db.query(
        `INSERT INTO registration_email_codes
           (email,invite_hash,code_hash,expires_at,sent_at,window_start,window_sends,attempts)
         VALUES ($1,$2,$3,now()+interval '10 minutes',now(),now(),1,0)
         ON CONFLICT (email) DO UPDATE SET
           invite_hash=EXCLUDED.invite_hash,code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,
           sent_at=now(),window_start=CASE
             WHEN registration_email_codes.window_start < now()-interval '1 hour' THEN now()
             ELSE registration_email_codes.window_start END,
           window_sends=CASE
             WHEN registration_email_codes.window_start < now()-interval '1 hour' THEN 1
             ELSE registration_email_codes.window_sends+1 END,
           attempts=0`,
        [email, ih, ch],
      )
      // Keep one email's challenge locked until SMTP accepts the message.
      await sendVerificationMail(email, otp)
      await db.query('COMMIT')
      res.json({ ok: true, expiresInSeconds: 600 })
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      if (error?.message === 'SMTP_UNCONFIGURED') return res.status(503).json({ error: '邮件服务未配置' })
      console.error('Unable to send registration email', error?.message)
      return res.status(502).json({ error: '验证码邮件暂时发送失败，请稍后重试' })
    } finally { db.release() }
  })

  app.post('/api/auth/register', registerLimiter, async (req, res, next) => {
    const email = normalizeEmail(req.body?.email)
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const invite = normalizeInviteCode(req.body?.inviteCode)
    const otp = req.body?.emailCode
    if (!validEmail(email)) return res.status(400).json({ error: '请输入正确的邮箱地址' })
    if (password.length < 6 || password.length > 128) return res.status(400).json({ error: '密码长度需要为 6–128 位' })
    if (!invite) return badInvitation(res)
    if (!validOtp(otp)) return res.status(400).json({ error: '请输入收到的 6 位邮箱验证码' })
    const ih = inviteCodeHash(invite)
    const db = await pool.connect().catch(next)
    if (!db) return
    try {
      // Hash before taking PostgreSQL row locks.
      const hash = await bcrypt.hash(password, 12)
      await db.query('BEGIN')
      const available = await db.query(
        'SELECT id FROM registration_invites WHERE code_hash=$1 AND used_at IS NULL AND revoked_at IS NULL FOR UPDATE', [ih],
      )
      if (!available.rows.length) { await db.query('ROLLBACK'); return badInvitation(res) }
      const challenge = await db.query(
        'SELECT invite_hash,code_hash,expires_at,attempts FROM registration_email_codes WHERE email=$1 FOR UPDATE', [email],
      )
      const record = challenge.rows[0]
      if (!record || record.invite_hash !== ih || new Date(record.expires_at) <= new Date() || record.attempts >= 5) {
        await db.query('ROLLBACK')
        return res.status(400).json({ error: '验证码不存在、已失效或错误次数过多，请重新获取' })
      }
      if (!secureMatchHex(record.code_hash, otpHash(secret, email, ih, otp.trim()))) {
        await db.query('UPDATE registration_email_codes SET attempts=attempts+1 WHERE email=$1', [email])
        await db.query('COMMIT')
        return res.status(400).json({ error: '邮箱验证码不正确' })
      }
      const displayName = email.split('@')[0].replace(/[^\p{L}\p{N}_.-]/gu, '').slice(0, 40) || 'PawCream'
      const created = await db.query(
        'INSERT INTO users (email,password_hash,display_name) VALUES ($1,$2,$3) RETURNING id,email,display_name,role',
        [email,hash,displayName],
      )
      const user = created.rows[0]
      await db.query('UPDATE registration_invites SET used_by=$2,used_at=now() WHERE id=$1',
        [available.rows[0].id,user.id])
      await db.query('DELETE FROM registration_email_codes WHERE email=$1', [email])
      await db.query('COMMIT')

      // A DB-committed registration survives a failure to establish a browser session.
      try {
        await new Promise((resolve, reject) => req.session.regenerate((err) => err ? reject(err) : resolve()))
        req.session.user = { id:user.id,email:user.email,displayName:user.display_name,role:user.role }
        await new Promise((resolve,reject) => req.session.save(err => err ? reject(err) : resolve()))
      } catch (sessionError) {
        console.error('Unable to save session after signup', sessionError?.message)
        return res.status(201).json({ user: publicUser({ id:user.id,email:user.email,displayName:user.display_name,role:user.role }), sessionReady:false })
      }
      res.status(201).json({ user: publicUser(req.session.user), sessionReady:true })
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') return res.status(409).json({ error: '邮箱已经注册过了' })
      next(error)
    } finally { db.release() }
  })
}
