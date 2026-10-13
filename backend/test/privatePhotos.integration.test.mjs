import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { registerPrivatePhotoRoutes } from '../src/privatePhotoRoutes.js'
import { newPrivatePhotoKey } from '../src/photoStorage.js'

const DB = process.env.TEST_DATABASE_URL
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64',
)

test('private tin photos: uploads are idempotent and all reads/deletes are owner-scoped', { skip: !DB }, async () => {
  const pool = new pg.Pool({ connectionString: DB })
  const suffix = randomUUID()
  const a = await pool.query(
    "INSERT INTO users(email,password_hash,display_name) VALUES($1,'test','Alice') RETURNING id",
    [`photo-a-${suffix}@example.test`],
  )
  const b = await pool.query(
    "INSERT INTO users(email,password_hash,display_name) VALUES($1,'test','Bob') RETURNING id",
    [`photo-b-${suffix}@example.test`],
  )
  const owners = { a: a.rows[0].id, b: b.rows[0].id }
  const objects = new Map()
  const storage = {
    enabled: true,
    newKey: newPrivatePhotoKey,
    put: async (key, bytes) => { objects.set(key, Buffer.from(bytes)) },
    read: async key => {
      if (!objects.has(key)) throw Object.assign(new Error('Not found'), { status: 404 })
      return objects.get(key)
    },
    remove: async key => { objects.delete(key) },
  }
  const app = express()
  app.use((req, res, next) => {
    const owner = owners[req.get('x-test-account')]
    req.session = { user: owner ? { id: owner, displayName: 'Owner' } : null }
    next()
  })
  const requireAuth = (req, res, next) => req.session.user
    ? next() : res.status(401).json({ error: '请先登录' })
  registerPrivatePhotoRoutes(app, pool, requireAuth, storage)
  app.use((error, req, res, next) => {
    res.status(500).json({ error: error.message })
  })
  const server = app.listen(0, '127.0.0.1')
  try {
    await new Promise(resolve => server.once('listening', resolve))
    const host = `http://127.0.0.1:${server.address().port}`
    const call = (account, path, method = 'GET', data) => fetch(host + path, {
      method,
      headers: {
        ...(account ? { 'x-test-account': account } : {}),
        ...(data ? { 'Content-Type': 'image/png' } : {}),
      },
      ...(data ? { body: data } : {}),
    })
    const clientId = 'photo-' + randomUUID()
    const target = `/api/private-photos?clientPhotoId=${clientId}&frameName=classic`
    assert.equal((await call(null, '/api/private-photos')).status, 401)
    assert.equal((await call(null, target, 'POST', tinyPng)).status, 401)
    assert.equal((await call('a', '/api/private-photos')).status, 200)

    const created = await call('a', target, 'POST', tinyPng)
    assert.equal(created.status, 201)
    assert.equal((await created.json()).photo.clientPhotoId, clientId)
    assert.equal(objects.size, 1)
    assert.equal((await call('a', target, 'POST', tinyPng)).status, 200)
    assert.equal(objects.size, 1, 'retry must not allocate another OSS object')
    const bad = await call('a', `/api/private-photos?clientPhotoId=invalid&frameName=test`, 'POST', tinyPng)
    assert.equal(bad.status, 400)

    const listA = await (await call('a', '/api/private-photos')).json()
    const listB = await (await call('b', '/api/private-photos')).json()
    assert.equal(listA.total, 1)
    assert.equal(listB.total, 0)
    assert.ok(!JSON.stringify(listA).includes('oss_key'), 'never reveal private OSS object keys')

    const imagePath = `/api/private-photos/${clientId}/image`
    const ownerImage = await call('a', imagePath)
    assert.equal(ownerImage.status, 200)
    assert.equal(ownerImage.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(Buffer.from(await ownerImage.arrayBuffer()), tinyPng)
    assert.equal((await call('b', imagePath)).status, 404)
    assert.equal((await call(null, imagePath)).status, 401)
    assert.equal((await call('b', `/api/private-photos/${clientId}`, 'DELETE')).status, 404)
    assert.equal((await call('a', imagePath)).status, 200)

    // Each source slot is a private OSS object, not a public-wall photo.
    const slot0 = `/api/private-photos/${clientId}/sources/0`
    const slot3 = `/api/private-photos/${clientId}/sources/3`
    const slotsPath = `/api/private-photos/${clientId}/sources`
    assert.equal((await call(null, slotsPath)).status, 401)
    assert.equal((await call(null, slot0, 'POST', tinyPng)).status, 401)
    assert.equal((await call('b', slot0, 'POST', tinyPng)).status, 404)
    assert.equal((await call('a', slot0, 'POST', tinyPng)).status, 201)
    assert.equal((await call('a', slot0, 'POST', tinyPng)).status, 200)
    assert.equal((await call('a', slot3, 'POST', tinyPng)).status, 201)
    assert.equal(objects.size, 3, 'same-slot retries must be idempotent')
    assert.deepEqual((await (await call('a', slotsPath)).json()).slots, [0, 3])
    assert.deepEqual((await (await call('b', slotsPath)).json()).slots, [])
    assert.equal((await call('b', slot0)).status, 404)
    assert.equal((await call(null, slot0)).status, 401)
    const sourceImage = await call('a', slot0)
    assert.equal(sourceImage.status, 200)
    assert.equal(sourceImage.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(Buffer.from(await sourceImage.arrayBuffer()), tinyPng)
    assert.equal((await call('a', `/api/private-photos/${clientId}/sources/4`, 'POST', tinyPng)).status, 400)

    assert.equal((await call('b', target, 'POST', tinyPng)).status, 201)
    assert.equal(objects.size, 4, 'sources and composites have separate OSS objects')

    // One private composite may have a legacy framed publication and up to four
    // independently publicized slot originals. They must all disappear when the
    // owner deletes their tin photo; another user's or unrelated public art stays.
    const publishedClientIds = [clientId, `${clientId}-slot-0`, `${clientId}-slot-3`]
    const addPublic = async (ownerId, publicClientId) => {
      const publicKey = `public/${ownerId}/${randomUUID()}.png`
      objects.set(publicKey, tinyPng)
      await pool.query(
        'INSERT INTO public_photos(user_id,client_photo_id,author_name,frame_name,image_type,oss_key) ' +
        'VALUES ($1,$2,$3,$4,$5,$6)',
        [ownerId, publicClientId, 'Test', 'original', 'image/png', publicKey],
      )
      return publicKey
    }
    const ownedPublicKeys = await Promise.all(publishedClientIds.map(id => addPublic(owners.a, id)))
    const unrelatedKey = await addPublic(owners.a, 'photo-' + randomUUID())
    const otherOwnerKey = await addPublic(owners.b, publishedClientIds[1])
    assert.ok(ownedPublicKeys.every(key => objects.has(key)))
    assert.equal((await call('a', `/api/private-photos/${clientId}`, 'DELETE')).status, 200)
    assert.equal((await call('a', imagePath)).status, 404)
    assert.equal((await call('b', imagePath)).status, 200,
      'deleting one owner must not delete another owner\'s same-ID private photo')
    assert.equal((await (await call('a', slotsPath)).json()).slots.length, 0)
    assert.ok(ownedPublicKeys.every(key => !objects.has(key)), 'remove all matching public OSS originals')
    assert.equal(objects.size, 3, 'preserve unrelated public artwork and the other owner\'s private/public objects')
    assert.ok(objects.has(unrelatedKey))
    assert.ok(objects.has(otherOwnerKey))
    const remainingPublic = await pool.query(
      'SELECT user_id,client_photo_id FROM public_photos WHERE user_id = ANY($1::uuid[])',
      [[owners.a, owners.b]],
    )
    assert.equal(remainingPublic.rows.length, 2)
    assert.ok(remainingPublic.rows.some(row =>
      row.user_id === owners.b && row.client_photo_id === publishedClientIds[1]))
    assert.ok(remainingPublic.rows.some(row =>
      row.user_id === owners.a && row.client_photo_id !== clientId))
    assert.equal((await call('a', `/api/private-photos/${clientId}`, 'DELETE')).status, 404)
  } finally {
    await new Promise(resolve => server.close(resolve))
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[owners.a, owners.b]])
    await pool.end()
  }
})
