import bcrypt from 'bcryptjs'
import connectPgSimple from 'connect-pg-simple'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'
import pg from 'pg'
import nodemailer from 'nodemailer'
import { validPhotoBytes } from './photoValidation.js'
import {
  createEmailCode,
  hashEmailCode,
  matchesEmailCode,
  normalizeInviteCode,
  validEmailCode,
  validInviteCode,
} from './registrationSecurity.js'

const { Pool } = pg

const PORT = Number(process.env.PORT || 8787)
const DATABASE_URL = process.env.DATABASE_URL
const SESSION_SECRET = process.env.SESSION_SECRET
const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_FROM = process.env.SMTP_FROM || ''
const COOKIE_SAME_SITE = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase()
const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false'

if (!DATABASE_URL) throw new Error('DATABASE_URL is required')
if (!SESSION_SECRET || SESSION_SECRET.length < 24) {
  throw new Error('SESSION_SECRET must be set and contain at least 24 characters')
}

const pool = new Pool({ connectionString: DATABASE_URL })
const mailer = SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      requireTLS: !SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null
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

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
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

app.post('/api/auth/send-email-code', verificationLimiter, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email)
  const inviteCode = normalizeInviteCode(req.body?.inviteCode)

  if (!validEmail(email)) return res.status(400).json({ error: '请输入正确的邮箱地址' })
  if (!validInviteCode(inviteCode)) return res.status(400).json({ error: '邀请码格式不正确' })
  if (!mailer) return res.status(503).json({ error: '邮箱验证码服务尚未配置，请联系管理员' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const invite = await client.query(
      'SELECT code FROM invite_codes WHERE code = $1 AND used_at IS NULL',
      [inviteCode],
    )
    if (!invite.rowCount) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: '邀请码不存在或已经使用' })
    }

    const registered = await client.query('SELECT id FROM users WHERE email = $1', [email])
    if (registered.rowCount) {
      await client.query('COMMIT')
      return res.json({ ok: true })
    }

    await client.query(
      `INSERT INTO email_verifications
       (email, code_hash, expires_at, last_sent_at, window_started_at, sent_in_window)
       VALUES ($1, repeat('0', 64), now(), now() - interval '1 hour',
               now() - interval '1 hour', 0)
       ON CONFLICT (email) DO NOTHING`,
      [email],
    )
    const result = await client.query(
      'SELECT last_sent_at, window_started_at, sent_in_window FROM email_verifications WHERE email = $1 FOR UPDATE',
      [email],
    )
    const previous = result.rows[0]
    const now = Date.now()
    if (now - new Date(previous.last_sent_at).getTime() < 60_000) {
      await client.query('ROLLBACK')
      return res.status(429).json({ error: '请在 60 秒后重新发送验证码' })
    }
    const inWindow = now - new Date(previous.window_started_at).getTime() < 3_600_000
    if (inWindow && previous.sent_in_window >= 5) {
      await client.query('ROLLBACK')
      return res.status(429).json({ error: '此邮箱一小时内发送过于频繁，请稍后再试' })
    }

    const code = createEmailCode()
    await client.query(
      `UPDATE email_verifications
       SET code_hash = $2, expires_at = now() + interval '10 minutes',
           attempts = 0, last_sent_at = now(),
           window_started_at = CASE WHEN $3 THEN window_started_at ELSE now() END,
           sent_in_window = CASE WHEN $3 THEN sent_in_window + 1 ELSE 1 END
       WHERE email = $1`,
      [email, hashEmailCode(email, code, SESSION_SECRET), inWindow],
    )

    await mailer.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'PawCream 注册邮箱验证码',
      text: `欢迎来到 PawCream！\n\n你的注册验证码是：${code}\n10 分钟内有效，请不要转发给他人。\n\n如果不是你本人操作，请忽略这封邮件。`,
    })
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    client.release()
  }
})

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const inviteCode = normalizeInviteCode(req.body?.inviteCode)
  const emailCode = String(req.body?.emailCode || '').trim()

  if (!validEmail(email)) return res.status(400).json({ error: '请输入正确的邮箱地址' })
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: '密码长度需要为 6–128 位' })
  }
  if (!validInviteCode(inviteCode)) return res.status(400).json({ error: '请输入有效的邀请码' })
  if (!validEmailCode(emailCode)) return res.status(400).json({ error: '请输入 6 位邮箱验证码' })

  const passwordHash = await bcrypt.hash(password, 12)
  const displayName = displayNameFromEmail(email)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Lock the invitation so two parallel registrations cannot consume it.
    const invite = await client.query(
      'SELECT code FROM invite_codes WHERE code = $1 AND used_at IS NULL FOR UPDATE',
      [inviteCode],
    )
    if (!invite.rowCount) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: '邀请码不存在或已经使用' })
    }

    const verification = await client.query(
      'SELECT code_hash, expires_at, attempts FROM email_verifications WHERE email = $1 FOR UPDATE',
      [email],
    )
    const record = verification.rows[0]
    if (!record || Date.now() > new Date(record.expires_at).getTime() || record.attempts >= 5) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: '邮箱验证码已失效，请重新获取' })
    }
    if (!matchesEmailCode(email, emailCode, record.code_hash.trim(), SESSION_SECRET)) {
      await client.query(
        'UPDATE email_verifications SET attempts = attempts + 1 WHERE email = $1',
        [email],
      )
      await client.query('COMMIT')
      return res.status(400).json({ error: '邮箱验证码不正确' })
    }

    const created = await client.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, role`,
      [email, passwordHash, displayName],
    )
    const row = created.rows[0]
    await client.query(
      'UPDATE invite_codes SET used_at = now(), used_by = $2 WHERE code = $1',
      [inviteCode, row.id],
    )
    await client.query('DELETE FROM email_verifications WHERE email = $1', [email])
    await client.query('COMMIT')

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
    await client.query('ROLLBACK').catch(() => {})
    if (error?.code === '23505') {
      return res.status(409).json({ error: '这个邮箱已经注册过了' })
    }
    next(error)
  } finally {
    client.release()
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


const photoUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

function publicPhoto(row, mine = false) {
  return {
    id: row.id,
    authorName: row.author_name,
    frameName: row.frame_name,
    createdAt: row.created_at,
    ...(mine ? { clientPhotoId: row.client_photo_id } : {}),
  };
}

// Public: cross-account gallery metadata only. Private browser photos never enter this table.
app.get('/api/photos', async (req, res, next) => {
  const mine = req.query.scope === 'mine';
  if (mine && !req.session.user) return res.status(401).json({ error: '请先登录 PawCream 账号' });
  const limit = Math.min(40, Math.max(1, Number.parseInt(String(req.query.limit || '24'), 10) || 24));
  const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
  const where = mine ? 'WHERE user_id = $3::uuid' : '';
  const args = mine ? [limit, offset, req.session.user.id] : [limit, offset];
  try {
    const [result, count] = await Promise.all([
      pool.query(`SELECT id, author_name, frame_name, client_photo_id, created_at FROM public_photos ${where}
                  ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, args),
      pool.query(`SELECT COUNT(*)::int AS total FROM public_photos ${mine ? 'WHERE user_id = $1::uuid' : ''}`,
        mine ? [req.session.user.id] : []),
    ]);
    res.set('Cache-Control', 'no-store').json({
      photos: result.rows.map((row) => publicPhoto(row, mine)),
      total: count.rows[0].total,
    });
  } catch (error) { next(error); }
});

app.get('/api/photos/mine/:clientId', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, author_name, frame_name, client_photo_id, created_at FROM public_photos WHERE user_id = $1 AND client_photo_id = $2',
      [req.session.user.id, req.params.clientId],
    );
    res.set('Cache-Control', 'no-store').json({
      photo: result.rows[0] ? publicPhoto(result.rows[0], true) : null,
    });
  } catch (error) { next(error); }
});

app.get('/api/photos/:id/image', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT image_type, image_data FROM public_photos WHERE id = $1::uuid', [req.params.id]);
    if (!result.rows[0]) return res.status(404).end();
    res.set('Cache-Control', 'no-store');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.type(result.rows[0].image_type).send(result.rows[0].image_data);
  } catch (error) {
    if (error?.code === '22P02') return res.status(404).end();
    next(error);
  }
});

app.post('/api/photos', requireAuth, photoUploadLimiter,
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '3mb' }),
  async (req, res, next) => {
    const type = String(req.get('content-type') || '').split(';')[0].toLowerCase();
    const clientId = String(req.query.clientPhotoId || '');
    const frameName = String(req.query.frameName || '').trim();
    if (!validPhotoBytes(req.body, type)) {
      return res.status(415).json({ error: '只允许上传不超过 3MB 的 PNG、JPEG 或 WebP 图片' });
    }
    if (!/^photo-[A-Za-z0-9-]{8,85}$/.test(clientId) || !frameName || frameName.length > 80) {
      return res.status(400).json({ error: '照片标识或相纸类型无效' });
    }
    try {
      const result = await pool.query(
        `INSERT INTO public_photos (user_id, client_photo_id, author_name, frame_name, image_type, image_data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, client_photo_id) DO UPDATE
         SET image_type = EXCLUDED.image_type, image_data = EXCLUDED.image_data,
             frame_name = EXCLUDED.frame_name, author_name = EXCLUDED.author_name
         RETURNING id, author_name, frame_name, client_photo_id, created_at`,
        [req.session.user.id, clientId, req.session.user.displayName, frameName, type, req.body],
      );
      res.status(201).json({ photo: publicPhoto(result.rows[0], true) });
    } catch (error) { next(error); }
  },
);

app.delete('/api/photos/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await pool.query(
      'DELETE FROM public_photos WHERE id = $1::uuid AND user_id = $2 RETURNING id',
      [req.params.id, req.session.user.id],
    );
    if (!deleted.rowCount) return res.status(404).json({ error: '没有找到可撤回的返图' });
    res.json({ ok: true });
  } catch (error) {
    if (error?.code === '22P02') return res.status(404).json({ error: '没有找到可撤回的返图' });
    next(error);
  }
});

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
