import type {Submission, SubmissionsApi} from '#/core/Connection.js'
import PLazy from 'p-lazy'
import {type Database, desc, eq, sql, table} from 'rado'
import * as column from 'rado/universal/columns'

export interface SubmissionStoreOptions {
  db: Database | Promise<Database>
}

const SubmissionTable = table('alinea_submission', {
  id: column.varchar(undefined, {length: 27}).primaryKey(),
  entryId: column.varchar(undefined, {length: 27}).notNull(),
  locale: column.text(),
  field: column.text().notNull(),
  values: column.json<Record<string, unknown>>().notNull(),
  definition: column.json<unknown>().notNull(),
  createdAt: column.integer().notNull()
})

const prepared = new WeakMap<Database, Promise<Database>>()

/** Keeps the submissions of forms in a table of the backend's database */
export class SubmissionStore implements SubmissionsApi {
  #db: Promise<Database>

  constructor({db}: SubmissionStoreOptions) {
    this.#db = Promise.resolve(db).then(prepare)
  }

  async storeSubmission(submission: Submission): Promise<void> {
    const db = await this.#db
    await db.insert(SubmissionTable).values(submission)
  }

  async listSubmissions(entryId: string): Promise<Array<Submission>> {
    const db = await this.#db
    return db
      .select()
      .from(SubmissionTable)
      .where(eq(SubmissionTable.entryId, entryId))
      .orderBy(desc(SubmissionTable.createdAt))
  }
}

function prepare(db: Database): Promise<Database> {
  const existing = prepared.get(db)
  if (existing) return existing
  const result = PLazy.from(async () => {
    await db.migrate(SubmissionTable)
    // Not exposed to the world if the database is in Supabase
    if (db.dialect.runtime === 'postgres')
      await db.run(
        sql`alter table ${SubmissionTable} enable row level security`
      )
    return db
  })
  prepared.set(db, result)
  return result
}
