import pg from 'pg'
import { createInviteCode } from '../src/registrationSecurity.js'

const count = Number(process.argv[2])
if (!Number.isInteger(count) || count < 1 || count > 200) {
  console.error('Usage: node scripts/create-invites.mjs <count: 1-200>')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set (run inside the API container).')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  let generated = 0
  while (generated < count) {
    const code = createInviteCode()
    const result = await pool.query(
      'INSERT INTO invite_codes (code) VALUES ($1) ON CONFLICT DO NOTHING RETURNING code',
      [code],
    )
    if (!result.rowCount) continue
    console.log(result.rows[0].code)
    generated += 1
  }
} finally {
  await pool.end()
}
