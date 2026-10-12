import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { validPhotoBytes } from './photoValidation.js'
import {
  PHOTO_STORAGE, newPrivatePhotoKey, putPublicPhoto, readPublicPhoto, deletePublicPhoto,
} from './photoStorage.js'

const MAX_PRIVATE_BYTES = 12 * 1024 * 1024
const privateUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

const validClientId = value => typeof value === 'string' && /^photo-[A-Za-z0-9-]{8,85}$/.test(value)

function privatePhoto(row) {
  return {
    id: row.id,
    clientPhotoId: row.client_photo_id,
    frameName: row.frame_name,
    createdAt: row.created_at,
  }
}

// Optional storage adapter keeps API authorization testable without real OSS credentials.
export function registerPrivatePhotoRoutes(app, pool, requireAuth, storage = {
  enabled: PHOTO_STORAGE === 'oss',
  newKey: newPrivatePhotoKey,
  put: putPublicPhoto,
  read: readPublicPhoto,
  remove: deletePublicPhoto,
}) {
  // None of these routes are exposed on the public gallery or to admins.
  app.get('/api/private-photos', requireAuth, async (req, res, next) => {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100))
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0)
    try {
      const [rows, count] = await Promise.all([
        pool.query(
          'SELECT id,client_photo_id,frame_name,created_at FROM private_photos ' +
          'WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3',
          [req.session.user.id, limit, offset],
        ),
        pool.query('SELECT COUNT(*)::int AS total FROM private_photos WHERE user_id=$1', [req.session.user.id]),
      ])
      res.set('Cache-Control', 'private, no-store').json({
        photos: rows.rows.map(privatePhoto),
        total: count.rows[0].total,
      })
    } catch (error) { next(error) }
  })

  app.get('/api/private-photos/:clientId/image', requireAuth, async (req, res, next) => {
    if (!validClientId(req.params.clientId)) return res.status(404).end()
    try {
      const result = await pool.query(
        'SELECT image_type,oss_key FROM private_photos WHERE user_id=$1 AND client_photo_id=$2',
        [req.session.user.id, req.params.clientId],
      )
      if (!result.rows.length) return res.status(404).end()
      const row = result.rows[0]
      const bytes = await storage.read(row.oss_key)
      res.set('Cache-Control', 'private, no-store')
      res.set('Cross-Origin-Resource-Policy', 'same-origin')
      res.set('X-Content-Type-Options', 'nosniff')
      return res.type(row.image_type).send(bytes)
    } catch (error) {
      if (error?.status === 404) return res.status(404).end()
      next(error)
    }
  })

  app.post('/api/private-photos', requireAuth, privateUploadLimiter,
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MAX_PRIVATE_BYTES }),
    async (req, res, next) => {
      if (!storage.enabled) return res.status(503).json({ error: '私人云端铁盒需要启用 OSS 存储' })
      const type = String(req.get('content-type') || '').split(';')[0].toLowerCase()
      const clientId = req.query.clientPhotoId
      const frameName = typeof req.query.frameName === 'string' ? req.query.frameName.trim() : ''
      if (!validClientId(clientId) || !frameName || frameName.length > 80) {
        return res.status(400).json({ error: '照片标识或相纸类型无效' })
      }
      if (!validPhotoBytes(req.body, type, MAX_PRIVATE_BYTES)) {
        return res.status(415).json({ error: '只允许上传不超过 12MB 的 PNG、JPEG 或 WebP 图片' })
      }
      // Upload retries are safe: a client photo id is permanently bound to one owner/object.
      let uploadedKey
      try {
        const ownerId = req.session.user.id
        const existing = await pool.query(
          'SELECT id,client_photo_id,frame_name,created_at FROM private_photos WHERE user_id=$1 AND client_photo_id=$2',
          [ownerId, clientId],
        )
        if (existing.rows.length) return res.set('Cache-Control', 'no-store').json({ photo: privatePhoto(existing.rows[0]) })
        const incomingTime = typeof req.query.createdAt === 'string' ? new Date(req.query.createdAt) : new Date()
        const createdAt = Number.isFinite(incomingTime.getTime()) &&
          incomingTime <= new Date() && incomingTime.getTime() >= Date.UTC(2000, 0, 1)
          ? incomingTime : new Date()

        uploadedKey = storage.newKey(ownerId, type)
        await storage.put(uploadedKey, req.body, type)
        const inserted = await pool.query(
          'INSERT INTO private_photos(user_id,client_photo_id,frame_name,image_type,oss_key,created_at) ' +
          'VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id,client_photo_id) DO NOTHING ' +
          'RETURNING id,client_photo_id,frame_name,created_at',
          [ownerId, clientId, frameName, type, uploadedKey, createdAt],
        )
        if (!inserted.rows.length) {
          const winning = await pool.query(
            'SELECT id,client_photo_id,frame_name,created_at FROM private_photos WHERE user_id=$1 AND client_photo_id=$2',
            [ownerId, clientId],
          )
          if (!winning.rows.length) throw new Error('Private photo was concurrently removed')
          return res.set('Cache-Control', 'no-store').json({ photo: privatePhoto(winning.rows[0]) })
        }
        uploadedKey = null // The database now owns this OSS object.
        return res.status(201).set('Cache-Control', 'no-store').json({ photo: privatePhoto(inserted.rows[0]) })
      } catch (error) {
        next(error)
      } finally {
        if (uploadedKey) {
          await storage.remove(uploadedKey).catch((error) => {
            console.error('Unable to clean up unreferenced private photo object', error?.message)
          })
        }
      }
    },
  )

  // Original source pixels are distinct private objects: never expose OSS keys
  // and never include sources in the public wall unless the owner publishes them.
  app.get('/api/private-photos/:clientId/sources', requireAuth, async (req, res, next) => {
    if (!validClientId(req.params.clientId)) return res.status(404).end()
    try {
      const result = await pool.query(
        'SELECT s.slot_index FROM private_photo_sources s ' +
        'JOIN private_photos p ON p.id=s.private_photo_id ' +
        'WHERE p.user_id=$1 AND p.client_photo_id=$2 ORDER BY s.slot_index',
        [req.session.user.id, req.params.clientId],
      )
      res.set('Cache-Control', 'private, no-store').json({ slots: result.rows.map(row => row.slot_index) })
    } catch (error) { next(error) }
  })

  app.get('/api/private-photos/:clientId/sources/:slot', requireAuth, async (req, res, next) => {
    const slot = Number(req.params.slot)
    if (!validClientId(req.params.clientId) || !Number.isInteger(slot) || slot < 0 || slot > 3) {
      return res.status(404).end()
    }
    try {
      const result = await pool.query(
        'SELECT s.image_type,s.oss_key FROM private_photo_sources s ' +
        'JOIN private_photos p ON p.id=s.private_photo_id ' +
        'WHERE p.user_id=$1 AND p.client_photo_id=$2 AND s.slot_index=$3',
        [req.session.user.id, req.params.clientId, slot],
      )
      if (!result.rows.length) return res.status(404).end()
      const bytes = await storage.read(result.rows[0].oss_key)
      return res.set('Cache-Control', 'private, no-store')
        .set('Cross-Origin-Resource-Policy', 'same-origin')
        .set('X-Content-Type-Options', 'nosniff')
        .type(result.rows[0].image_type).send(bytes)
    } catch (error) {
      if (error?.status === 404) return res.status(404).end()
      next(error)
    }
  })

  app.post('/api/private-photos/:clientId/sources/:slot', requireAuth, privateUploadLimiter,
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MAX_PRIVATE_BYTES }),
    async (req, res, next) => {
      const slot = Number(req.params.slot)
      if (!validClientId(req.params.clientId) || !Number.isInteger(slot) || slot < 0 || slot > 3) {
        return res.status(400).json({ error: '无效的照片格子' })
      }
      if (!storage.enabled) return res.status(503).json({ error: '请先配置 OSS 私人照片存储' })
      const type = String(req.get('content-type') || '').split(';')[0].toLowerCase()
      if (!validPhotoBytes(req.body, type, MAX_PRIVATE_BYTES)) {
        return res.status(415).json({ error: '原图须为不超过 12MB 的 PNG、JPEG 或 WebP' })
      }
      let uploadedKey
      try {
        const ownerId = req.session.user.id
        const parent = await pool.query(
          'SELECT id FROM private_photos WHERE user_id=$1 AND client_photo_id=$2',
          [ownerId, req.params.clientId],
        )
        if (!parent.rows.length) return res.status(404).json({ error: '私人拍立得不存在' })
        const parentId = parent.rows[0].id
        const existing = await pool.query(
          'SELECT 1 FROM private_photo_sources WHERE private_photo_id=$1 AND slot_index=$2',
          [parentId, slot],
        )
        if (existing.rows.length) return res.set('Cache-Control', 'no-store').json({ ok: true })
        uploadedKey = storage.newKey(ownerId, type)
        await storage.put(uploadedKey, req.body, type)
        const inserted = await pool.query(
          'INSERT INTO private_photo_sources(private_photo_id,slot_index,image_type,oss_key) ' +
          'VALUES($1,$2,$3,$4) ON CONFLICT(private_photo_id,slot_index) DO NOTHING RETURNING slot_index',
          [parentId, slot, type, uploadedKey],
        )
        if (inserted.rowCount) uploadedKey = null
        res.status(201).set('Cache-Control', 'no-store').json({ ok: true })
      } catch (error) { next(error) }
      finally {
        if (uploadedKey) await storage.remove(uploadedKey).catch(error => {
          console.error('Unable to clean up source upload', error?.message)
        })
      }
    },
  )

  app.delete('/api/private-photos/:clientId', requireAuth, async (req, res, next) => {
    if (!validClientId(req.params.clientId)) return res.status(404).json({ error: '照片不存在' })
    let client
    try {
      client = await pool.connect()
      await client.query('BEGIN')
      const found = await client.query(
        'SELECT oss_key FROM private_photos WHERE user_id=$1 AND client_photo_id=$2 FOR UPDATE',
        [req.session.user.id, req.params.clientId],
      )
      if (!found.rows.length) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: '照片不存在' })
      }
      // Remove source objects too; all source rows are cascade-deleted with parent.
      const sources = await client.query(
        'SELECT s.oss_key FROM private_photo_sources s JOIN private_photos p ON p.id=s.private_photo_id ' +
        'WHERE p.user_id=$1 AND p.client_photo_id=$2 ORDER BY s.slot_index',
        [req.session.user.id, req.params.clientId],
      )
      for (const source of sources.rows) await storage.remove(source.oss_key)
      // Only acknowledge removal once the composite object is also deleted.
      await storage.remove(found.rows[0].oss_key)
      await client.query(
        'DELETE FROM private_photos WHERE user_id=$1 AND client_photo_id=$2',
        [req.session.user.id, req.params.clientId],
      )
      await client.query('COMMIT')
      res.set('Cache-Control', 'no-store').json({ ok: true })
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      next(error)
    } finally {
      client?.release()
    }
  })
}
