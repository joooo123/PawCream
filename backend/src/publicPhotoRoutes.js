import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { validPhotoBytes } from './photoValidation.js'
import {
  PHOTO_STORAGE,
  newPublicPhotoKey,
  putPublicPhoto,
  readPublicPhoto,
  deletePublicPhoto,
} from './photoStorage.js'

const photoUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

function publicPhoto(row, mine = false) {
  return {
    id: row.id,
    authorName: row.author_name,
    frameName: row.frame_name,
    createdAt: row.created_at,
    ...(mine ? { clientPhotoId: row.client_photo_id } : {}),
  }
}

// Public wall is deliberately distinct from locally stored private tin-box photos.
export function registerPhotoRoutes(app, pool, requireAuth) {
  app.get('/api/photos', async (req, res, next) => {
    const mine = req.query.scope === 'mine'
    if (mine && !req.session.user) return res.status(401).json({ error: '请先登录 PawCream 账号' })
    const limit = Math.min(40, Math.max(1, Number.parseInt(String(req.query.limit || '24'), 10) || 24))
    const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0)
    const where = mine ? 'WHERE user_id = $3::uuid' : ''
    const args = mine ? [limit, offset, req.session.user.id] : [limit, offset]
    try {
      const [result, count] = await Promise.all([
        pool.query(
          'SELECT id, author_name, frame_name, client_photo_id, created_at FROM public_photos ' +
          where + ' ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
          args,
        ),
        pool.query(
          'SELECT COUNT(*)::int AS total FROM public_photos ' +
          (mine ? 'WHERE user_id = $1::uuid' : ''),
          mine ? [req.session.user.id] : [],
        ),
      ])
      res.set('Cache-Control', 'no-store').json({
        photos: result.rows.map((row) => publicPhoto(row, mine)),
        total: Number(count.rows[0].total),
      })
    } catch (error) { next(error) }
  })

  app.get('/api/photos/mine/:clientId', requireAuth, async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT id, author_name, frame_name, client_photo_id, created_at FROM public_photos WHERE user_id = $1 AND client_photo_id = $2',
        [req.session.user.id, req.params.clientId],
      )
      res.set('Cache-Control', 'no-store').json({
        photo: result.rows[0] ? publicPhoto(result.rows[0], true) : null,
      })
    } catch (error) { next(error) }
  })

  // Keep this same-origin API route while ICP filing is pending.
  // OSS object keys are never exposed to browsers and the Bucket stays private.
  app.get('/api/photos/:id/image', async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT image_type, image_data, oss_key FROM public_photos WHERE id = $1::uuid',
        [req.params.id],
      )
      const row = result.rows[0]
      if (!row) return res.status(404).end()
      const image = row.oss_key ? await readPublicPhoto(row.oss_key) : row.image_data
      res.set('Cache-Control', 'no-store')
      res.set('Cross-Origin-Resource-Policy', 'cross-origin')
      res.type(row.image_type).send(image)
    } catch (error) {
      if (error?.code === '22P02' || error?.status === 404) return res.status(404).end()
      next(error)
    }
  })

  app.post('/api/photos', requireAuth, photoUploadLimiter,
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '3mb' }),
    async (req, res, next) => {
      const type = String(req.get('content-type') || '').split(';')[0].toLowerCase()
      const clientId = String(req.query.clientPhotoId || '')
      const frameName = String(req.query.frameName || '').trim()
      if (!validPhotoBytes(req.body, type)) {
        return res.status(415).json({ error: '只允许上传不超过 3MB 的 PNG、JPEG 或 WebP 图片' })
      }
      if (!/^photo-[A-Za-z0-9-]{8,85}$/.test(clientId) || !frameName || frameName.length > 80) {
        return res.status(400).json({ error: '照片标识或相纸类型无效' })
      }

      const newKey = PHOTO_STORAGE === 'oss' ? newPublicPhotoKey(req.session.user.id, type) : null
      let uploaded = false
      try {
        const old = await pool.query(
          'SELECT oss_key FROM public_photos WHERE user_id = $1 AND client_photo_id = $2',
          [req.session.user.id, clientId],
        )
        if (newKey) {
          await putPublicPhoto(newKey, req.body, type)
          uploaded = true
        }

        const result = await pool.query(
          'INSERT INTO public_photos (user_id, client_photo_id, author_name, frame_name, image_type, image_data, oss_key) ' +
          'VALUES ($1, $2, $3, $4, $5, $6, $7) ' +
          'ON CONFLICT (user_id, client_photo_id) DO UPDATE SET ' +
          'image_type = EXCLUDED.image_type, image_data = EXCLUDED.image_data, ' +
          'oss_key = EXCLUDED.oss_key, frame_name = EXCLUDED.frame_name, ' +
          'author_name = EXCLUDED.author_name ' +
          'RETURNING id, author_name, frame_name, client_photo_id, created_at',
          [
            req.session.user.id, clientId, req.session.user.displayName, frameName,
            type, newKey ? null : req.body, newKey,
          ],
        )

        const oldKey = old.rows[0]?.oss_key
        if (oldKey && oldKey !== newKey) {
          // A failed cleanup must not undo a successfully published replacement.
          await deletePublicPhoto(oldKey).catch((error) => {
            console.error('Unable to delete superseded OSS object', error)
          })
        }
        res.status(201).json({ photo: publicPhoto(result.rows[0], true) })
      } catch (error) {
        if (uploaded && newKey) {
          await deletePublicPhoto(newKey).catch((cleanupError) => {
            console.error('Unable to clean up failed photo upload', cleanupError)
          })
        }
        next(error)
      }
    },
  )

  app.delete('/api/photos/:id', requireAuth, async (req, res, next) => {
    const client = await pool.connect().catch(next)
    if (!client) return
    try {
      await client.query('BEGIN')
      const found = await client.query(
        'SELECT oss_key FROM public_photos WHERE id = $1::uuid AND user_id = $2 FOR UPDATE',
        [req.params.id, req.session.user.id],
      )
      if (!found.rows[0]) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: '没有找到可撤回的返图' })
      }
      if (found.rows[0].oss_key) await deletePublicPhoto(found.rows[0].oss_key)
      await client.query(
        'DELETE FROM public_photos WHERE id = $1::uuid AND user_id = $2',
        [req.params.id, req.session.user.id],
      )
      await client.query('COMMIT')
      res.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error?.code === '22P02') {
        res.status(404).json({ error: '没有找到可撤回的返图' })
        return
      }
      next(error)
    } finally {
      client.release()
    }
  })
}
