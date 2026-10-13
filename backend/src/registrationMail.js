import crypto from 'node:crypto'
import nodemailer from 'nodemailer'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const NORMALIZE = /^PC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/
export function generateInviteCode() {
  const segment = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')
  return `PC-${segment()}-${segment()}`
}
export function normalizeInviteCode(raw) {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  return NORMALIZE.test(code) ? code : null
}
export function inviteCodeHash(code) {
  return crypto.createHash('sha256').update(code).digest('hex')
}
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}
export function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
export function validOtp(value) {
  return typeof value === 'string' && /^[0-9]{6}$/.test(value.trim())
}
export function otpHash(secret, email, inviteHash, code) {
  return crypto.createHmac('sha256', secret).update(`${email}:\x00${inviteHash}:\x00${code}`).digest('hex')
}
export function secureMatchHex(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(String(a)) || !/^[a-f0-9]{64}$/i.test(String(b))) return false
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

const SMTP_HOST = (process.env.SMTP_HOST || '').trim()
const SMTP_FROM = (process.env.SMTP_FROM || '').trim()
const SMTP_USER = (process.env.SMTP_USER || '').trim()
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'
const MAIL_ENABLED = Boolean(SMTP_HOST && SMTP_FROM && SMTP_PORT > 0 && SMTP_PORT < 65536 && (!SMTP_USER || SMTP_PASS))

let transporter
export function mailConfigured() { return MAIL_ENABLED }
export async function sendVerificationMail(to, code) {
  if (!MAIL_ENABLED) throw new Error('SMTP_UNCONFIGURED')
  transporter ||= nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
    // Remote port-587 relays MUST negotiate STARTTLS (no silent cleartext fallback).
    // Loopback SMTP is used only by the isolated automated test mail sink.
    requireTLS: !SMTP_SECURE && SMTP_HOST !== '127.0.0.1' && SMTP_HOST !== 'localhost',
    ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })
  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: 'PawCream 注册邮箱验证码',
    text: `欢迎加入 PawCream！\n\n你的注册验证码：${code}\n有效期 10 分钟，仅用于这次注册。请不要将验证码分享给他人。\n\n如果你没有申请注册，请忽略此邮件。\n`,
  })
}
