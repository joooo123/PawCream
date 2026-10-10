import assert from 'node:assert/strict'
import test from 'node:test'
import { validPhotoBytes } from '../src/photoValidation.js'

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])
const jpeg = Buffer.from([255, 216, 255, 224, 0])
const webp = Buffer.from('RIFF0000WEBPxxxx', 'ascii')

test('accepts supported image signatures', () => {
  assert.equal(validPhotoBytes(png, 'image/png'), true)
  assert.equal(validPhotoBytes(jpeg, 'image/jpeg'), true)
  assert.equal(validPhotoBytes(webp, 'image/webp'), true)
})

test('rejects empty, mislabeled, and oversized uploads', () => {
  assert.equal(validPhotoBytes(Buffer.alloc(0), 'image/png'), false)
  assert.equal(validPhotoBytes(jpeg, 'image/png'), false)
  assert.equal(validPhotoBytes(png, 'text/html'), false)
  assert.equal(validPhotoBytes(Buffer.alloc(3 * 1024 * 1024 + 1), 'image/png'), false)
})
