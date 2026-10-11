import test from 'node:test'
import assert from 'node:assert/strict'
import { validUuid, pageParams, sameOrigin } from '../src/adminRoutes.js'

test('admin ids must be UUIDs, not arbitrary SQL inputs', () => {
  assert.equal(validUuid('c05ddf72-5589-4949-8a8b-40ef6906c6e6'), true)
  assert.equal(validUuid('1;DROP TABLE users;'), false)
  assert.equal(validUuid(''), false)
})
test('pagination is bounded', () => {
  assert.deepEqual(pageParams({ offset:'-4' }), { limit:20, offset:0 })
  assert.deepEqual(pageParams({ offset:'100000000' }), { limit:20, offset:100000 })
  assert.deepEqual(pageParams({ offset:'NaN' }), { limit:20, offset:0 })
})
test('admin state changes reject missing or foreign origin', () => {
  const req = (origin) => ({
    protocol: 'https',
    get(name) { return name==='host' ? 'pawcream.studio' : name==='origin' ? origin : '' },
  })
  assert.equal(sameOrigin(req('https://pawcream.studio')), true)
  assert.equal(sameOrigin(req('https://evil.example')), false)
  assert.equal(sameOrigin(req('https://pawcream.studio.evil.example')), false)
  assert.equal(sameOrigin(req(undefined)), false)
})
