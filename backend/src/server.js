import bcrypt from 'bcryptjs'
import connectPgSimple from 'connect-pg-simple'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'
import pg from 'pg'

const { Pool } = pg

const PORT = Number(process.env.PORT || 8787)
const DATABASE_URL = process.env.DATABASE_URL
const SESSION_SECRET = process.env.SESSION_SECRET
const INVITE_CODE = process.env.INVITE_CODE || ''
const COOKIE_SAME_SITE = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase()
const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false'

if (!DATABASE_URL) throw new Error('DATABASE_URL is required')
if (!SESSION_SECRET || SESSION_SECRET.length < 24) {
  throw new Error('SESSION_SECRET must be set and contain at least 24 characters')
}

const pool = new Pool({ connectionString: DATABASE_URL })
const PgSession = connectPgSimple(session)
const app = express()

app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '16kb' }))

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

if (allowedOrigins.length) {
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin is not allowed'))
    },
  }))
}

const sameSite = COOKIE_SAME_SITE === 'none'
  ? 'none'
  : COOKIE_SAME_SITE === 'strict'
    ? 'strict'
    : 'lax'

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: false,
  }),
  name: 'pawcream.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
}))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function displayNameFromEmail(email) {
  const base = email.split('@')[0].replace(/[^\p{L}\p{N}_.-]/gu, '').slice(0, 40)
  return base || 'PawCream'
}

function cleanNoteText(value) {
  return String(value || '').trim().slice(0, 280)
}

function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  }
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    res.status(401).json({ error: '请先登录 PawCream 账号' })
    return
  }
  next()
}

function rowToNote(row) {
  return {
    id: row.id,
    text: row.content,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    likesCount: Number(row.likes_count || 0),
    likedByMe: Boolean(row.liked_by_me),
    isMine: Boolean(row.is_mine),
  }
}

async function fetchOneNote(noteId, viewerId) {
  const result = await pool.query(
    `
      SELECT
        n.id,
        n.user_id,
        n.content,
        n.author_name,
        n.created_at,
        n.updated_at,
        COUNT(l.user_id)::int AS likes_count,
        COALESCE(BOOL_OR(l.user_id = $2::uuid), false) AS liked_by_me,
        COALESCE(n.user_id = $2::uuid, false) AS is_mine
      FROM notes n
      LEFT JOIN note_likes l ON l.note_id = n.id
      WHERE n.id = $1::uuid AND n.is_hidden = false
      GROUP BY n.id
    `,
    [noteId, viewerId || null],
  )
  return result.rows[0] || null
}

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', (req, res) => {
  res.json({ user: publicUser(req.session.user || null) })
})

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const inviteCode = String(req.body?.inviteCode || '').trim()

  if (!validEmail(email)) {
    res.status(400).json({ error: '请输入正确的邮箱地址' })
    return
  }
  if (password.length < 6 || password.length > 128) {
    res.status(400).json({ error: '密码长度需要为 6–128 位' })
    return
  }
  if (INVITE_CODE && inviteCode !== INVITE_CODE) {
    res.status(403).json({ error: '邀请码不正确' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const displayName = displayNameFromEmail(email)
    const result = await pool.query(
      `
        INSERT INTO users (email, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING id, email, display_name, role
      `,
      [email, passwordHash, displayName],
    )

    const row = result.rows[0]
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()))
    req.session.user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    }
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()))

    res.status(201).json({ user: publicUser(req.session.user) })
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ error: '这个邮箱已经注册过了' })
      return
    }
    next(error)
  }
})

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, display_name, role FROM users WHERE email = $1',
      [email],
    )
    const row = result.rows[0]
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      res.status(401).json({ error: '邮箱或密码不正确' })
      return
    }

    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()))
    req.session.user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    }
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()))

    res.json({ user: publicUser(req.session.user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error)
      return
    }
    res.clearCookie('pawcream.sid')
    res.json({ ok: true })
  })
})

app.get('/api/notes', async (req, res, next) => {
  const scope = req.query.scope === 'mine' ? 'mine' : 'all'
  const viewerId = req.session.user?.id || null

  if (scope === 'mine' && !viewerId) {
    res.status(401).json({ error: '请先登录 PawCream 账号' })
    return
  }

  const order = req.query.order === 'random' ? 'random' : 'recent'
  const rawLimit = Number.parseInt(String(req.query.limit || '12'), 10)
  const rawOffset = Number.parseInt(String(req.query.offset || '0'), 10)
  const limit = Math.min(24, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 12))
  const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0)
  const seed = String(req.query.seed || 'pawcream').slice(0, 80)

  try {
    if (scope === 'mine') {
      const [result, countResult] = await Promise.all([
        pool.query(
          `
            SELECT
              n.id,
              n.user_id,
              n.content,
              n.author_name,
              n.created_at,
              n.updated_at,
              COUNT(l.user_id)::int AS likes_count,
              COALESCE(BOOL_OR(l.user_id = $1::uuid), false) AS liked_by_me,
              true AS is_mine
            FROM notes n
            LEFT JOIN note_likes l ON l.note_id = n.id
            WHERE n.is_hidden = false
              AND n.user_id = $1::uuid
            GROUP BY n.id
            ORDER BY n.created_at DESC
            LIMIT 100
          `,
          [viewerId],
        ),
        pool.query(
          'SELECT COUNT(*)::int AS total FROM notes WHERE is_hidden = false AND user_id = $1::uuid',
          [viewerId],
        ),
      ])

      res.json({
        notes: result.rows.map(rowToNote),
        total: Number(countResult.rows[0]?.total || 0),
      })
      return
    }

    const [result, countResult] = await Promise.all([
      pool.query(
        `
          SELECT
            n.id,
            n.user_id,
            n.content,
            n.author_name,
            n.created_at,
            n.updated_at,
            COUNT(l.user_id)::int AS likes_count,
            COALESCE(BOOL_OR(l.user_id = $1::uuid), false) AS liked_by_me,
            COALESCE(n.user_id = $1::uuid, false) AS is_mine
          FROM notes n
          LEFT JOIN note_likes l ON l.note_id = n.id
          WHERE n.is_hidden = false
          GROUP BY n.id
          ORDER BY
            CASE WHEN $2::text = 'random' THEN md5(n.id::text || $3::text) END ASC,
            CASE WHEN $2::text <> 'random' THEN n.created_at END DESC,
            n.id ASC
          LIMIT $4
          OFFSET $5
        `,
        [viewerId, order, seed, limit, offset],
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM notes WHERE is_hidden = false'),
    ])

    res.json({
      notes: result.rows.map(rowToNote),
      total: Number(countResult.rows[0]?.total || 0),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/notes', requireAuth, async (req, res, next) => {
  const text = cleanNoteText(req.body?.text)
  if (!text) {
    res.status(400).json({ error: '便签内容不能为空' })
    return
  }

  try {
    const user = req.session.user
    const result = await pool.query(
      `
        INSERT INTO notes (user_id, author_name, content)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [user.id, user.displayName, text],
    )
    const row = await fetchOneNote(result.rows[0].id, user.id)
    res.status(201).json({ note: rowToNote(row) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/notes/:id', requireAuth, async (req, res, next) => {
  const text = cleanNoteText(req.body?.text)
  if (!text) {
    res.status(400).json({ error: '便签内容不能为空' })
    return
  }

  try {
    const owner = await pool.query('SELECT user_id FROM notes WHERE id = $1::uuid', [req.params.id])
    if (!owner.rows[0]) {
      res.status(404).json({ error: '没有找到这张便签' })
      return
    }

    const user = req.session.user
    if (owner.rows[0].user_id !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: '只能编辑自己的便签' })
      return
    }

    await pool.query(
      'UPDATE notes SET content = $1, updated_at = now() WHERE id = $2::uuid',
      [text, req.params.id],
    )
    const row = await fetchOneNote(req.params.id, user.id)
    res.json({ note: rowToNote(row) })
  } catch (error) {
    if (error?.code === '22P02') {
      res.status(404).json({ error: '没有找到这张便签' })
      return
    }
    next(error)
  }
})

app.delete('/api/notes/:id', requireAuth, async (req, res, next) => {
  try {
    const owner = await pool.query('SELECT user_id FROM notes WHERE id = $1::uuid', [req.params.id])
    if (!owner.rows[0]) {
      res.status(404).json({ error: '没有找到这张便签' })
      return
    }

    const user = req.session.user
    if (owner.rows[0].user_id !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: '只能删除自己的便签' })
      return
    }

    await pool.query('DELETE FROM notes WHERE id = $1::uuid', [req.params.id])
    res.json({ ok: true })
  } catch (error) {
    if (error?.code === '22P02') {
      res.status(404).json({ error: '没有找到这张便签' })
      return
    }
    next(error)
  }
})

app.post('/api/notes/:id/like', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const note = await client.query(
      'SELECT id FROM notes WHERE id = $1::uuid AND is_hidden = false FOR UPDATE',
      [req.params.id],
    )
    if (!note.rows[0]) {
      await client.query('ROLLBACK')
      res.status(404).json({ error: '没有找到这张便签' })
      return
    }

    const userId = req.session.user.id
    const removed = await client.query(
      'DELETE FROM note_likes WHERE user_id = $1::uuid AND note_id = $2::uuid RETURNING user_id',
      [userId, req.params.id],
    )

    let liked = false
    if (!removed.rowCount) {
      await client.query(
        'INSERT INTO note_likes (user_id, note_id) VALUES ($1::uuid, $2::uuid)',
        [userId, req.params.id],
      )
      liked = true
    }

    const count = await client.query(
      'SELECT COUNT(*)::int AS count FROM note_likes WHERE note_id = $1::uuid',
      [req.params.id],
    )
    await client.query('COMMIT')

    res.json({ liked, likesCount: Number(count.rows[0].count) })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error?.code === '22P02') {
      res.status(404).json({ error: '没有找到这张便签' })
      return
    }
    next(error)
  } finally {
    client.release()
  }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'PawCream 服务暂时出了点问题，请稍后再试' })
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`PawCream API listening on :${PORT}`)
})

async function shutdown(signal) {
  console.log(`${signal}: shutting down`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
