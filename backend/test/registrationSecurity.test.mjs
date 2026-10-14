import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInviteCode,
  normalizeInviteCode,
  validInviteCode,
  createEmailCode,
  validEmailCode,
  hashEmailCode,
  matchesEmailCode,
} from '../src/registrationSecurity.js'

test('invitation codes are short, consistently formatted and unpredictable', () => {
  const codes = Array.from({ length: 300 }, createInviteCode)
  assert.equal(new Set(codes).size, codes.length)
  assert.ok(codes.every(validInviteCode))
  assert.equal(normalizeInviteCode('  pc-abcd-2345  '), 'PC-ABCD-2345')
  assert.equal(validInviteCode('PC-0000-0000'), false)
})

test('email codes are six numeric digits and scoped to their email', () => {
  const codes = Array.from({ length: 300 }, createEmailCode)
  assert.ok(codes.every(validEmailCode))
  assert.equal(validEmailCode('12345'), false)
  assert.equal(validEmailCode('abcdef'), false)

  const secret = 'test-secret-not-for-production'
  const hash = hashEmailCode('alice@example.com', '042069', secret)
  assert.equal(matchesEmailCode('alice@example.com', '042069', hash, secret), true)
  assert.equal(matchesEmailCode('alice@example.com', '042068', hash, secret), false)
  assert.equal(matchesEmailCode('bob@example.com', '042069', hash, secret), false)
  assert.equal(matchesEmailCode('alice@example.com', '042069', 'invalid', secret), false)
})
