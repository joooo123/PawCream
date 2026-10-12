import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateInviteCode, normalizeInviteCode, inviteCodeHash, validOtp,
  otpHash, secureMatchHex,
} from '../src/registrationMail.js'

test('invitation: fixed readable pattern, cryptographically random and normalized', () => {
  const codes = Array.from({length:400},generateInviteCode)
  assert.equal(new Set(codes).size, codes.length)
  for (const code of codes) {
    assert.match(code,/^PC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    assert.equal(normalizeInviteCode(code.toLowerCase()),code)
    assert.equal(inviteCodeHash(code).length,64)
  }
  assert.equal(normalizeInviteCode('PC-0000-0000'),null)
  assert.equal(normalizeInviteCode('PC-ABCD-1234'),null) // 1 is ambiguous
  assert.equal(normalizeInviteCode('foo'),null)
})

test('OTP: strict six-digit challenge hashes bound to email and invite', () => {
  const h=otpHash('secret','foo@example.test',inviteCodeHash('PC-ABCD-EFGH'),'234567')
  assert.ok(validOtp('234567'))
  assert.equal(validOtp('12345'),false)
  assert.equal(validOtp('12345a'),false)
  assert.ok(secureMatchHex(h,h))
  assert.equal(secureMatchHex(h,otpHash('secret','evil@example.test',inviteCodeHash('PC-ABCD-EFGH'),'234567')),false)
})
