import assert from 'node:assert/strict'
import test from 'node:test'
import { PHOTO_STORAGE, newPublicPhotoKey } from '../src/photoStorage.js'

test('legacy database storage is the safe initial default', () => {
  assert.equal(PHOTO_STORAGE, 'database')
})

test('public photo keys are unique and scoped to the owner', () => {
  const userId = 'c05ddf72-5589-4949-8a8b-40ef6906c6e6'
  const a = newPublicPhotoKey(userId, 'image/webp')
  const b = newPublicPhotoKey(userId, 'image/webp')
  assert.match(a, /^public\/c05ddf72-5589-4949-8a8b-40ef6906c6e6\/[a-f0-9-]{36}\.webp$/)
  assert.notEqual(a, b)
  assert.match(newPublicPhotoKey(userId, 'image/png'), /\.png$/)
  assert.match(newPublicPhotoKey(userId, 'image/jpeg'), /\.jpg$/)
  assert.throws(() => newPublicPhotoKey(userId, 'image/svg+xml'))
  assert.throws(() => newPublicPhotoKey('../admin', 'image/webp'))
})
