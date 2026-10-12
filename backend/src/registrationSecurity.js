import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase()
}

export function createInviteCode() {
  let random = ''
  for (let index = 0; index < 8; index += 1) {
    random += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]
  }
  return `PC-${random.slice(0, 4)}-${random.slice(4)}`
}

export function validInviteCode(code) {
  return /^PC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code)
}

export function createEmailCode() {
  return String(randomInt(1_000_000)).padStart(6, '0')
}

export function validEmailCode(code) {
  return /^\d{6}$/.test(code)
}

export function hashEmailCode(email, code, secret) {
  return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex')
}

export function matchesEmailCode(email, code, hash, secret) {
  if (!validEmailCode(code) || !/^[a-f0-9]{64}$/.test(hash || '')) return false
  return timingSafeEqual(
    Buffer.from(hashEmailCode(email, code, secret), 'hex'),
    Buffer.from(hash, 'hex'),
  )
}
