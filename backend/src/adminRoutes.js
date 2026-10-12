import { readPublicPhoto } from './photoStorage.js'

export function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
export function pageParams(query = {}) {
  const parsedOffset = Number.parseInt(String(query.offset ?? '0'), 10)
  return {
    limit: 20,
    offset: Number.isFinite(parsedOffset) ? Math.max(0, Math.min(parsedOffset, 100000)) : 0,
  }
}
// Same-origin check for cookie-authenticated state changes. Prevents CSRF
// even if SameSite/cookie browser behaviors change. The reverse proxy forwards
// the original Host and scheme; do not use permissive CORS for this check.
export function sameOrigin(req) {
  const origin = req.get('origin')
  const host = req.get('host')
  if (!origin || !host) return false
  return origin === `${req.protocol}://${host}`
}

function idOr400(req, res) {
  if (validUuid(req.params.id)) return true
  res.status(400).json({ error: '无效的记录标识' })
  return false
}

function requireAdmin(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: '请先登录' })
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' })
  next()
}

export function requireSameOrigin(req, res, next) {
  if (!sameOrigin(req)) return res.status(403).json({ error: '跨站请求被拒绝' })
  next()
}

async function atomicAction(pool, actor, action, target, targetId, details, change) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const result = await change(db)
    if (!result || result.conflict) {
      await db.query('ROLLBACK')
      return result
    }
    await db.query(
      'INSERT INTO admin_audit (actor_user_id,actor_email,action,target_type,target_id,details) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
      [actor.id, actor.email, action, target, targetId, JSON.stringify(details)],
    )
    await db.query('COMMIT')
    return result
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    db.release()
  }
}

export function registerAdminRoutes(app, pool) {
  app.use('/api/admin', (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store')
    next()
  }, requireAdmin)

  app.get('/api/admin/overview', async (_req, res, next) => {
    try {
      const results = await Promise.all([
        pool.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE is_disabled)::int AS disabled FROM users"),
        pool.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE is_hidden)::int AS hidden FROM notes"),
        pool.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE is_hidden)::int AS hidden FROM public_photos"),
      ])
      res.json({
        users: results[0].rows[0],
        notes: results[1].rows[0],
        photos: results[2].rows[0],
      })
    } catch (error) { next(error) }
  })

  app.get('/api/admin/users', async (req, res, next) => {
    const { limit, offset } = pageParams(req.query)
    const q = String(req.query.q || '').trim().slice(0, 80)
    try {
      const [data, count] = await Promise.all([
        pool.query(
          `SELECT u.id,u.email,u.display_name AS "displayName",u.role,u.created_at AS "createdAt",
                  u.is_disabled AS "disabled",u.disabled_at AS "disabledAt",u.disabled_reason AS "disabledReason",
                  (SELECT count(*)::int FROM notes n WHERE n.user_id=u.id) AS "noteCount",
                  (SELECT count(*)::int FROM public_photos p WHERE p.user_id=u.id) AS "photoCount"
             FROM users u
             WHERE ($1::text='' OR u.email::text ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')
             ORDER BY u.created_at DESC,u.id DESC LIMIT $2 OFFSET $3`,
          [q, limit, offset],
        ),
        pool.query(
          "SELECT count(*)::int AS total FROM users WHERE ($1::text='' OR email::text ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%')",
          [q],
        ),
      ])
      res.json({ items: data.rows, total: count.rows[0].total, limit, offset })
    } catch (error) { next(error) }
  })

  app.patch('/api/admin/users/:id/status', requireSameOrigin, async (req, res, next) => {
    if (!idOr400(req, res)) return
    if (typeof req.body?.disabled !== 'boolean') return res.status(400).json({ error: 'disabled 必须是布尔值' })
    const reason = String(req.body?.reason || '').trim()
    if (reason.length > 280 || (req.body.disabled && reason.length < 3)) {
      return res.status(400).json({ error: '封禁原因需要填写 3–280 个字符' })
    }
    if (req.params.id === req.session.user.id) return res.status(409).json({ error: '不能封禁自己的管理员账号' })
    try {
      const actor = req.session.user
      const result = await atomicAction(pool, actor,
        req.body.disabled ? 'user.disable' : 'user.enable', 'user', req.params.id,
        { reason: reason || null }, async (db) => {
          const found = await db.query('SELECT id,role,is_disabled FROM users WHERE id=$1 FOR UPDATE', [req.params.id])
          if (!found.rows.length) return null
          if (found.rows[0].role === 'admin') return { conflict: true }
          const updated = await db.query(
            `UPDATE users SET is_disabled=$2,disabled_at=CASE WHEN $2 THEN now() ELSE NULL END,
                disabled_reason=CASE WHEN $2 THEN $3 ELSE NULL END WHERE id=$1 RETURNING id,is_disabled AS disabled`,
            [req.params.id, req.body.disabled, reason],
          )
          return updated.rows[0]
        })
      if (!result) return res.status(404).json({ error: '账号不存在' })
      if (result.conflict) return res.status(409).json({ error: '不能操作管理员账号' })
      res.json({ user: result })
    } catch (error) { next(error) }
  })

  app.get('/api/admin/notes', async (req, res, next) => {
    const { limit, offset } = pageParams(req.query)
    const hidden = req.query.status === 'hidden' ? true : req.query.status === 'visible' ? false : null
    try {
      const [data, count] = await Promise.all([
        pool.query(
          `SELECT n.id,n.content AS text,n.author_name AS "authorName",n.is_hidden AS hidden,
                  n.created_at AS "createdAt",u.email AS "ownerEmail",u.is_disabled AS "ownerDisabled"
             FROM notes n JOIN users u ON u.id=n.user_id
             WHERE ($1::boolean IS NULL OR n.is_hidden=$1)
             ORDER BY n.created_at DESC,n.id DESC LIMIT $2 OFFSET $3`,
          [hidden, limit, offset],
        ),
        pool.query('SELECT count(*)::int AS total FROM notes WHERE ($1::boolean IS NULL OR is_hidden=$1)', [hidden]),
      ])
      res.json({ items: data.rows, total: count.rows[0].total, limit, offset })
    } catch (error) { next(error) }
  })

  app.get('/api/admin/photos', async (req, res, next) => {
    const { limit, offset } = pageParams(req.query)
    const hidden = req.query.status === 'hidden' ? true : req.query.status === 'visible' ? false : null
    try {
      const [data, count] = await Promise.all([
        pool.query(
          `SELECT p.id,p.author_name AS "authorName",p.frame_name AS "frameName",
                  p.is_hidden AS hidden,p.created_at AS "createdAt",
                  u.email AS "ownerEmail",u.is_disabled AS "ownerDisabled"
             FROM public_photos p JOIN users u ON u.id=p.user_id
             WHERE ($1::boolean IS NULL OR p.is_hidden=$1)
             ORDER BY p.created_at DESC,p.id DESC LIMIT $2 OFFSET $3`,
          [hidden, limit, offset],
        ),
        pool.query('SELECT count(*)::int AS total FROM public_photos WHERE ($1::boolean IS NULL OR is_hidden=$1)', [hidden]),
      ])
      res.json({ items: data.rows, total: count.rows[0].total, limit, offset })
    } catch (error) { next(error) }
  })

  app.get('/api/admin/photos/:id/image', async (req, res, next) => {
    if (!idOr400(req, res)) return
    try {
      const result = await pool.query('SELECT image_type,image_data,oss_key FROM public_photos WHERE id=$1', [req.params.id])
      if (!result.rows[0]) return res.status(404).end()
      const row = result.rows[0]
      const bytes = row.oss_key ? await readPublicPhoto(row.oss_key) : row.image_data
      res.set('X-Content-Type-Options', 'nosniff')
      res.type(row.image_type).send(bytes)
    } catch (error) { next(error) }
  })

  for (const target of ['notes', 'photos']) {
    const table = target === 'notes' ? 'notes' : 'public_photos'
    const kind = target === 'notes' ? 'note' : 'photo'
    app.patch(`/api/admin/${target}/:id/visibility`, requireSameOrigin, async (req, res, next) => {
      if (!idOr400(req, res)) return
      if (typeof req.body?.hidden !== 'boolean') return res.status(400).json({ error: 'hidden 必须是布尔值' })
      const reason = String(req.body?.reason || '').trim()
      if (reason.length > 280 || (req.body.hidden && reason.length < 3)) {
        return res.status(400).json({ error: '隐藏内容时需要填写 3–280 个字符的原因' })
      }
      try {
        const result = await atomicAction(pool, req.session.user,
          `${kind}.${req.body.hidden ? 'hide' : 'restore'}`, kind, req.params.id,
          { reason: reason || null }, async (db) => {
            // table names are hardcoded above, never taken from request input.
            const row = await db.query(`UPDATE ${table} SET is_hidden=$2 WHERE id=$1 RETURNING id,is_hidden AS hidden`,
              [req.params.id, req.body.hidden])
            return row.rows[0] || null
          })
        if (!result) return res.status(404).json({ error: '记录不存在' })
        res.json({ item: result })
      } catch (error) { next(error) }
    })
  }

  app.get('/api/admin/audit', async (req, res, next) => {
    const { limit, offset } = pageParams(req.query)
    try {
      const [rows, count] = await Promise.all([
        pool.query(
          `SELECT id,actor_email AS "actorEmail",action,target_type AS "targetType",target_id AS "targetId",
                  details,created_at AS "createdAt" FROM admin_audit
             ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2`,
          [limit, offset],
        ),
        pool.query('SELECT count(*)::int AS total FROM admin_audit'),
      ])
      res.json({ items: rows.rows, total: count.rows[0].total, limit, offset })
    } catch (error) { next(error) }
  })
}
