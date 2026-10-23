import type {
  StoredFormFile,
  Submission,
  SubmissionStatus,
  SubmissionsApi
} from '#/core/Connection.js'
import PLazy from 'p-lazy'
import {
  type Database,
  and,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  sql,
  table
} from 'rado'
import * as column from 'rado/universal/columns'
import {largeBlob} from './DatabaseApi.js'

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
  createdAt: column.integer().notNull(),
  status: column.text().$type<SubmissionStatus>().notNull().default('new'),
  notified: column.json<Array<string>>()
})

const FileTable = table('alinea_submission_file', {
  id: column.varchar(undefined, {length: 27}).primaryKey(),
  entryId: column.varchar(undefined, {length: 27}).notNull(),
  submissionId: column.varchar(undefined, {length: 27}),
  input: column.text().notNull(),
  name: column.text().notNull(),
  type: column.text().notNull(),
  size: column.integer().notNull(),
  content: largeBlob().notNull(),
  createdAt: column.integer().notNull()
})

const tables = [SubmissionTable, FileTable]

/** Files that were uploaded but not submitted are removed after this long */
const pendingFor = 24 * 60 * 60

const prepared = new WeakMap<Database, Promise<Database>>()

/** Keeps the submissions of forms and their files in the backend database */
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

  async updateSubmission(
    entryId: string,
    id: string,
    status: SubmissionStatus
  ): Promise<void> {
    const db = await this.#db
    await db
      .update(SubmissionTable)
      .set({status})
      .where(
        and(eq(SubmissionTable.entryId, entryId), eq(SubmissionTable.id, id))
      )
  }

  async deleteSubmission(entryId: string, id: string): Promise<void> {
    const db = await this.#db
    await db
      .delete(FileTable)
      .where(
        and(eq(FileTable.entryId, entryId), eq(FileTable.submissionId, id))
      )
    await db
      .delete(SubmissionTable)
      .where(
        and(eq(SubmissionTable.entryId, entryId), eq(SubmissionTable.id, id))
      )
  }

  async storeFormFile(file: StoredFormFile): Promise<void> {
    const db = await this.#db
    // Uploads that were never submitted are cleaned up as new ones come in
    await db
      .delete(FileTable)
      .where(
        and(
          isNull(FileTable.submissionId),
          lt(FileTable.createdAt, file.createdAt - pendingFor)
        )
      )
    await db.insert(FileTable).values(file)
  }

  async formFiles(
    entryId: string,
    ids: Array<string>
  ): Promise<Array<Omit<StoredFormFile, 'content'>>> {
    if (ids.length === 0) return []
    const db = await this.#db
    const {content, ...fields} = FileTable
    return db
      .select(fields)
      .from(FileTable)
      .where(and(eq(FileTable.entryId, entryId), inArray(FileTable.id, ids)))
  }

  async attachFormFiles(
    entryId: string,
    submissionId: string,
    ids: Array<string>
  ): Promise<void> {
    if (ids.length === 0) return
    const db = await this.#db
    await db
      .update(FileTable)
      .set({submissionId})
      .where(
        and(
          eq(FileTable.entryId, entryId),
          inArray(FileTable.id, ids),
          isNull(FileTable.submissionId)
        )
      )
  }

  async readFormFile(
    entryId: string,
    id: string
  ): Promise<StoredFormFile | undefined> {
    const db = await this.#db
    const [file] = await db
      .select()
      .from(FileTable)
      .where(and(eq(FileTable.entryId, entryId), eq(FileTable.id, id)))
    return file
  }
}

function prepare(db: Database): Promise<Database> {
  const existing = prepared.get(db)
  if (existing) return existing
  const result = PLazy.from(async () => {
    await db.migrate(...tables)
    // Not exposed to the world if the database is in Supabase
    if (db.dialect.runtime === 'postgres')
      for (const table of tables)
        await db.run(sql`alter table ${table} enable row level security`)
    return db
  })
  prepared.set(db, result)
  return result
}
