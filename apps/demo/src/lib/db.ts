import Database from 'better-sqlite3'
import {randomUUID} from 'crypto'
import fs from 'fs'
import path from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  // Use the temporary filesystem (ephemeral on serverless)
  const tmp = process.env.TMPDIR || '/tmp'
  const file = path.join(tmp, 'demo.sqlite')
  const firstTime = !fs.existsSync(file)

  db = new Database(file)

  if (firstTime) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        form_id TEXT NOT NULL,
        inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        data JSON
      );
    `)
    console.log('Database initialized at', file)
  }

  return db!
}

export async function GET() {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM submissions ORDER BY inserted_at DESC')
    .all()
  return Response.json(rows)
}

export async function POST(req: Request) {
  const payload = await req.json()
  const db = getDb()

  if (!payload.form_id) {
    return Response.json(
      {error: 'Missing required field: form_id'},
      {status: 400}
    )
  }

  const submission = {
    id: randomUUID(),
    form_id: payload.form_id,
    data: JSON.stringify(payload.data ?? {})
  }

  db.prepare(
    `INSERT INTO submissions (id, form_id, data) VALUES (@id, @form_id, @data)`
  ).run(submission)

  return Response.json({
    ok: true,
    submission
  })
}
