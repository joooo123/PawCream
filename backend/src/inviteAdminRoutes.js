import { generateInviteCode, inviteCodeHash } from './registrationMail.js'
import { validUuid, pageParams, requireSameOrigin } from './adminRoutes.js'

export function registerInviteAdminRoutes(app, pool) {
  app.get('/api/admin/invites', async (req,res,next) => {
    const { limit, offset } = pageParams(req.query)
    try {
      const [rows, total] = await Promise.all([
        pool.query(`
          SELECT i.id, i.last_four AS "lastFour", i.created_at AS "createdAt",
            i.used_at AS "usedAt", i.revoked_at AS "revokedAt",u.email AS "usedBy"
          FROM registration_invites i LEFT JOIN users u ON u.id=i.used_by
          ORDER BY i.created_at DESC,i.id DESC LIMIT $1 OFFSET $2`, [limit,offset]),
        pool.query('SELECT count(*)::int AS total FROM registration_invites'),
      ])
      res.json({items:rows.rows,total:total.rows[0].total,limit,offset})
    } catch (error) { next(error) }
  })

  app.post('/api/admin/invites', requireSameOrigin, async (req,res,next) => {
    const count = req.body?.count
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      return res.status(400).json({error:'每次只能生成 1–20 个邀请码'})
    }
    const db = await pool.connect().catch(next)
    if (!db) return
    try {
      await db.query('BEGIN')
      const created = []
      for (let i=0;i<count;i++) {
        const code=generateInviteCode()
        const hash=inviteCodeHash(code)
        const result=await db.query(
          'INSERT INTO registration_invites(code_hash,last_four,created_by) VALUES($1,$2,$3) RETURNING id',
          [hash,code.slice(-4),req.session.user.id])
        await db.query(
          `INSERT INTO admin_audit(actor_user_id,actor_email,action,target_type,target_id,details)
            VALUES($1,$2,'invite.create','invite',$3,'{}'::jsonb)`,
          [req.session.user.id,req.session.user.email,result.rows[0].id])
        created.push({id:result.rows[0].id,code})
      }
      await db.query('COMMIT')
      // Plaintext codes are only displayed once. Database contains SHA-256 hashes.
      res.status(201).json({codes:created})
    } catch (error) {
      await db.query('ROLLBACK').catch(()=>{})
      next(error)
    } finally { db.release() }
  })

  app.patch('/api/admin/invites/:id/revoke', requireSameOrigin, async (req,res,next) => {
    if (!validUuid(req.params.id)) return res.status(400).json({error:'无效的邀请码标识'})
    const db=await pool.connect().catch(next)
    if (!db) return
    try {
      await db.query('BEGIN')
      const change=await db.query(
        'UPDATE registration_invites SET revoked_at=now() WHERE id=$1 AND used_at IS NULL AND revoked_at IS NULL RETURNING id',
        [req.params.id])
      if (!change.rowCount) {
        await db.query('ROLLBACK')
        return res.status(409).json({error:'邀请码不存在，或已使用或已撤销'})
      }
      await db.query(
        `INSERT INTO admin_audit(actor_user_id,actor_email,action,target_type,target_id,details)
          VALUES($1,$2,'invite.revoke','invite',$3,'{}'::jsonb)`,
        [req.session.user.id,req.session.user.email,req.params.id])
      await db.query('COMMIT')
      res.json({ok:true})
    } catch (error) {
      await db.query('ROLLBACK').catch(()=>{})
      next(error)
    } finally {db.release()}
  })
}
