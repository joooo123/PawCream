import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { otpHash, inviteCodeHash } from '../src/registrationMail.js'
const DB = process.env.TEST_DATABASE_URL
const HOST = 'http://127.0.0.1:18787'
const json = (value) => JSON.stringify(value)

async function req(path, { cookie = '', method = 'GET', body, origin = HOST, headers = {} } = {}) {
  const response = await fetch(HOST + path, {
    method,
    headers: {
      ...(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body && !(body instanceof Buffer) ? json(body) : body,
  })
  return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0] || '', body: await response.json().catch(() => null) }
}

test('admin moderation: role boundary, CSRF, ban sessions, hide content, audit trail', { skip: !DB }, async () => {
  const pool = new pg.Pool({ connectionString: DB })
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('../', import.meta.url).pathname,
    env: {
      ...process.env,
      PORT: '18787',
      DATABASE_URL: DB,
      SESSION_SECRET: 'CI-TEST-ONLY-THIS-IS-NOT-A-PRODUCTION-SECRET-2026',
      INVITE_CODE: 'ci-only-code',
      COOKIE_SECURE: 'false',
      COOKIE_SAME_SITE: 'lax',
      CORS_ORIGIN: HOST,
      PHOTO_STORAGE: 'database',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let errors = ''
  server.stderr.setEncoding('utf8').on('data', data => { errors += data })
  try {
    let ready = false
    for (let i = 0; i < 80; i++) {
      try { const response = await fetch(HOST + '/api/health'); if (response.ok) { ready = true; break } } catch {}
      await new Promise(resolve => setTimeout(resolve, 125))
    }
    assert.ok(ready, 'test API did not become ready: ' + errors.slice(-400))

    // CI fixtures are created directly; public registrations now require a mailed OTP.
    const passwordHash = await bcrypt.hash('test-strong-password', 8)
    await pool.query(
      "INSERT INTO users(email,password_hash,display_name) VALUES ($1,$3,$2),($4,$3,$5)",
      ['owner-ci@example.test','Owner',passwordHash,'visitor-ci@example.test','Visitor'],
    )
    const admin = await req('/api/auth/login', { method:'POST', body:{email:'owner-ci@example.test',password:'test-strong-password'} })
    const visitor = await req('/api/auth/login', { method:'POST', body:{email:'visitor-ci@example.test',password:'test-strong-password'} })
    assert.equal(admin.status, 200)
    assert.equal(visitor.status, 200)
    assert.ok(admin.cookie && visitor.cookie)

    const beforePromotion = await req('/api/admin/overview', { cookie: admin.cookie })
    assert.equal(beforePromotion.status, 403)
    await pool.query("UPDATE users SET role='admin' WHERE email=$1", ['owner-ci@example.test'])
    const overview = await req('/api/admin/overview', { cookie: admin.cookie })
    assert.equal(overview.status, 200)
    assert.ok(overview.body.users.total >= 2)

    const createForbidden = await req('/api/admin/invites', {
      cookie: visitor.cookie, method:'POST', body:{count:1},
    })
    assert.equal(createForbidden.status, 403)
    const generated = await req('/api/admin/invites', {
      cookie: admin.cookie, method:'POST', body:{count:3},
    })
    assert.equal(generated.status, 201, JSON.stringify(generated.body))
    assert.equal(generated.body.codes.length, 3)
    assert.match(generated.body.codes[0].code, /^PC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    assert.equal(new Set(generated.body.codes.map(item => item.code)).size, 3)
    const invites = await req('/api/admin/invites', { cookie:admin.cookie })
    assert.equal(invites.status, 200)
    assert.equal(invites.body.items.length, 3)
    assert.equal(JSON.stringify(invites.body).includes(generated.body.codes[0].code), false)
    const revoked = await req(`/api/admin/invites/${generated.body.codes[2].id}/revoke`, {method:'PATCH',cookie:admin.cookie})
    assert.equal(revoked.status, 200)
    const resendRevoked = await req('/api/auth/email-code', {method:'POST',
      body:{email:'revoke-ci@example.test',inviteCode:generated.body.codes[2].code}})
    assert.equal(resendRevoked.status, 503) // SMTP configuration checked before invite validation

    const signupEmail = 'signup-ci@example.test'
    const invite = generated.body.codes[0].code
    const ih = inviteCodeHash(invite)
    // Check nickname validation and one-time invitation consumption.
    const blankName = await req('/api/auth/register', {method:'POST',body:{
      email:signupEmail,password:'a-strong-password',inviteCode:invite,emailCode:'123456',displayName:'   ',
    }})
    assert.equal(blankName.status, 400)
    assert.match(blankName.body.error, /昵称/)
    const longName = await req('/api/auth/register', {method:'POST',body:{
      email:signupEmail,password:'a-strong-password',inviteCode:invite,emailCode:'123456',displayName:'a'.repeat(41),
    }})
    assert.equal(longName.status, 400)
    assert.match(longName.body.error, /昵称/)
    const needsCode = await req('/api/auth/register', {method:'POST',body:{
      email:signupEmail,password:'a-strong-password',inviteCode:invite,emailCode:'987654',displayName:'奶油小熊',
    }})
    assert.equal(needsCode.status, 400)
    await pool.query(
      `INSERT INTO registration_email_codes(email,invite_hash,code_hash,expires_at)
         VALUES($1,$2,$3,now()+interval '10 minutes')`,
      [signupEmail,ih,otpHash('CI-TEST-ONLY-THIS-IS-NOT-A-PRODUCTION-SECRET-2026',signupEmail,ih,'123456')],
    )
    const wrong = await req('/api/auth/register', {method:'POST',body:{
      email:signupEmail,password:'a-strong-password',inviteCode:invite,emailCode:'999999',displayName:'奶油小熊',
    }})
    assert.equal(wrong.status, 400)
    const signed = await req('/api/auth/register', {method:'POST',body:{
      email:signupEmail,password:'a-strong-password',inviteCode:invite,emailCode:'123456',displayName:'奶油小熊',
    }})
    assert.equal(signed.status, 201, JSON.stringify(signed.body))
    assert.equal(signed.body.user.displayName, '奶油小熊')
    const nickname = await pool.query('SELECT display_name FROM users WHERE email=$1', [signupEmail])
    assert.equal(nickname.rows[0].display_name, '奶油小熊')
    const row = await pool.query('SELECT used_by,used_at FROM registration_invites WHERE code_hash=$1',[ih])
    assert.equal(row.rows[0].used_by,signed.body.user.id)
    assert.ok(row.rows[0].used_at)
    const reuse = await req('/api/auth/register', {method:'POST',body:{
      email:'another-ci@example.test',password:'a-strong-password',inviteCode:invite,emailCode:'123456',displayName:'另一个用户',
    }})
    assert.equal(reuse.status, 403)
    const restoredRegistration = await req('/api/auth/login',{method:'POST',body:{email:signupEmail,password:'a-strong-password'}})
    assert.equal(restoredRegistration.status,200)
    assert.equal(restoredRegistration.body.user.displayName, '奶油小熊')

    const userDenied = await req('/api/admin/users', { cookie: visitor.cookie })
    assert.equal(userDenied.status, 403)
    const unauthed = await req('/api/admin/users')
    assert.equal(unauthed.status, 401)

    const note = await req('/api/notes', { cookie:visitor.cookie, method:'POST', body:{text:'A photo note ready for moderation'} })
    assert.equal(note.status, 201)
    const noteId = note.body.note.id

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64')
    const photo = await req('/api/photos?clientPhotoId=photo-12345678&frameName=classic', {
      method:'POST', cookie:visitor.cookie, body:png, headers:{'Content-Type':'image/png'},
    })
    assert.equal(photo.status, 201, JSON.stringify(photo.body))
    const photoId = photo.body.photo.id

    const csrf = await req(`/api/admin/notes/${noteId}/visibility`, {
      cookie:admin.cookie, origin:'https://evil.example', method:'PATCH', body:{hidden:true,reason:'policy violation'},
    })
    assert.equal(csrf.status, 403)
    const hidden = await req(`/api/admin/notes/${noteId}/visibility`, {
      cookie:admin.cookie, method:'PATCH',body:{hidden:true,reason:'policy violation'},
    })
    assert.equal(hidden.status, 200)
    const notes = await req('/api/notes')
    assert.equal(notes.body.notes.some(x=>x.id===noteId), false)

    const hidePhoto = await req(`/api/admin/photos/${photoId}/visibility`, {
      cookie:admin.cookie, method:'PATCH',body:{hidden:true,reason:'policy violation'},
    })
    assert.equal(hidePhoto.status, 200)
    const publicPhotos = await req('/api/photos')
    assert.equal(publicPhotos.body.photos.some(x=>x.id===photoId), false)
    const image = await fetch(HOST + `/api/photos/${photoId}/image`)
    assert.equal(image.status, 404)
    const adminImage = await fetch(HOST + `/api/admin/photos/${photoId}/image`, {headers:{Cookie: admin.cookie}})
    assert.equal(adminImage.status, 200)

    const ban = await req(`/api/admin/users/${visitor.body.user.id}/status`, {
      cookie:admin.cookie, method:'PATCH', body:{disabled:true,reason:'repeated harmful content'},
    })
    assert.equal(ban.status, 200)
    const blocked = await req('/api/auth/me', { cookie: visitor.cookie })
    assert.equal(blocked.body.user, null)
    const loginBlocked = await req('/api/auth/login', {method:'POST',body:{email:'visitor-ci@example.test',password:'test-strong-password'}})
    assert.equal(loginBlocked.status, 401)
    const protectAdmin = await req(`/api/admin/users/${admin.body.user.id}/status`, {
      cookie:admin.cookie, method:'PATCH',body:{disabled:true,reason:'attempt'},
    })
    assert.equal(protectAdmin.status, 409)

    const audit = await req('/api/admin/audit', { cookie:admin.cookie })
    assert.equal(audit.status, 200)
    assert.ok(audit.body.items.some(x=>x.action==='user.disable'))
    assert.ok(audit.body.items.some(x=>x.action==='note.hide'))
    assert.ok(audit.body.items.some(x=>x.action==='photo.hide'))
  } finally {
    server.kill('SIGTERM')
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else { server.once('exit', resolve); setTimeout(resolve, 1500) } })
    await pool.end()
  }
})
