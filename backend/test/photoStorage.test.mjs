import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
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

test('lightweight RAM user mode rejects missing credentials without network requests', () => {
  const backendDir = fileURLToPath(new URL('..', import.meta.url))
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    "import('./src/photoStorage.js')",
  ], {
    cwd: backendDir,
    env: {
      ...process.env,
      PHOTO_STORAGE: 'oss',
      OSS_AUTH_MODE: 'access_key',
      OSS_BUCKET: 'pawcream-photo',
      OSS_ACCESS_KEY_ID: '',
      OSS_ACCESS_KEY_SECRET: '',
    },
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET are required/)
})

test('lightweight mode loads with non-empty credentials without contacting OSS', () => {
  const backendDir = fileURLToPath(new URL('..', import.meta.url))
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    "import('./src/photoStorage.js').then(() => console.log('loaded'))",
  ], {
    cwd: backendDir,
    env: {
      ...process.env,
      PHOTO_STORAGE: 'oss',
      OSS_AUTH_MODE: 'access_key',
      OSS_BUCKET: 'pawcream-photo',
      OSS_ACCESS_KEY_ID: 'DUMMY_FOR_TEST_ONLY',
      OSS_ACCESS_KEY_SECRET: 'DUMMY_FOR_TEST_ONLY',
    },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /loaded/)
})
