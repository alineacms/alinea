import type {
  FormFileKey,
  StoredFormFile,
  StoredSubmission,
  Submission,
  SubmissionPage,
  SubmissionQuery,
  SubmissionStatus,
  SubmissionsApi
} from '#/core/Connection.js'
import PLazy from 'p-lazy'
import {
  type Database,
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  index,
  isNull,
  like,
  lt,
  ne,
  or,
  sql,
  table
} from 'rado'
import * as column from 'rado/universal/columns'
import {choiceText} from '#/field/form/FormAnswers.js'
import {optionalLargeBlob} from './DatabaseApi.js'

export interface SubmissionStoreOptions {
  db: Database | Promise<Database>
}

/** A form as it was sent, kept once for all submissions sent with it */
const VersionTable = table('alinea_form_version', {
  id: column.varchar(undefined, {length: 64}).primaryKey(),
  entryId: column.varchar(undefined, {length: 27}).notNull(),
  definition: column.json<unknown>().notNull()
})

const SubmissionTable = table(
  'alinea_submission',
  {
    id: column.varchar(undefined, {length: 27}).primaryKey(),
    entryId: column.varchar(undefined, {length: 27}).notNull(),
    locale: column.text(),
    field: column.text().notNull(),
    values: column.json<Record<string, unknown>>().notNull(),
    version: column.varchar(undefined, {length: 64}).notNull().default(''),
    createdAt: column.integer().notNull(),
    status: column.text().$type<SubmissionStatus>().notNull().default('new'),
    notified: column.json<Array<string>>(),
    page: column.text(),
    search: column.text().notNull().default(''),
    choices: column.text().notNull().default(''),
    visitor: column.text(),
    expiresAt: column.integer()
  },
  row => [
    index('alinea_submission_by_entry').on(row.entryId, row.createdAt),
    index('alinea_submission_by_visitor').on(row.visitor, row.createdAt),
    index('alinea_submission_by_expiry').on(row.expiresAt)
  ]
)

const FileTable = table(
  'alinea_submission_file',
  {
    id: column.varchar(undefined, {length: 27}).primaryKey(),
    entryId: column.varchar(undefined, {length: 27}).notNull(),
    submissionId: column.varchar(undefined, {length: 27}),
    input: column.text().notNull(),
    name: column.text().notNull(),
    type: column.text().notNull(),
    size: column.integer().notNull(),
    // Empty when the file is kept in the storage of forms.files
    content: optionalLargeBlob(),
    visitor: column.text(),
    createdAt: column.integer().notNull()
  },
  row => [
    index('alinea_submission_file_by_submission').on(
      row.entryId,
      row.submissionId
    ),
    index('alinea_submission_file_by_visitor').on(row.visitor, row.createdAt),
    index('alinea_submission_file_by_time').on(row.createdAt)
  ]
)

const tables = [VersionTable, SubmissionTable, FileTable]

/** Files that were uploaded but not submitted are removed after this long */
const pendingFor = 24 * 60 * 60

const pageSize = 50
const maxPageSize = 500

const prepared = new WeakMap<Database, Promise<Database>>()

/** Keeps the submissions of forms and their files in the backend database */
export class SubmissionStore implements SubmissionsApi {
  #db: Promise<Database>

  constructor({db}: SubmissionStoreOptions) {
    this.#db = Promise.resolve(db).then(prepare)
  }

  async storeSubmission({
    definition,
    ...submission
  }: StoredSubmission): Promise<void> {
    const db = await this.#db
    const version = await definitionHash(submission.entryId, definition)
    const [known] = await db
      .select(VersionTable.id)
      .from(VersionTable)
      .where(eq(VersionTable.id, version))
    if (!known)
      try {
        await db
          .insert(VersionTable)
          .values({id: version, entryId: submission.entryId, definition})
      } catch {
        // Another submission of this version stored it meanwhile
      }
    await db.insert(SubmissionTable).values({...submission, version})
  }

  async listSubmissions(
    entryId: string,
    query: SubmissionQuery = {}
  ): Promise<SubmissionPage> {
    const db = await this.#db
    const where = and(
      eq(SubmissionTable.entryId, entryId),
      statusCondition(query.status ?? 'all'),
      query.from !== undefined
        ? gte(SubmissionTable.createdAt, query.from)
        : undefined,
      query.until !== undefined
        ? lt(SubmissionTable.createdAt, query.until)
        : undefined,
      query.choice
        ? like(
            SubmissionTable.choices,
            `%${choiceText(query.choice.key, query.choice.value)}%`
          )
        : undefined,
      query.search?.trim()
        ? like(SubmissionTable.search, `%${searchPattern(query.search)}%`)
        : undefined
    )
    const limit = Math.min(Math.max(query.limit ?? pageSize, 1), maxPageSize)
    const row = SubmissionTable
    const [rows, [{total}]] = await Promise.all([
      db
        .select({
          id: row.id,
          entryId: row.entryId,
          locale: row.locale,
          field: row.field,
          values: row.values,
          definition: VersionTable.definition,
          createdAt: row.createdAt,
          status: row.status,
          notified: row.notified,
          page: row.page
        })
        .from(SubmissionTable)
        .innerJoin(VersionTable, eq(VersionTable.id, SubmissionTable.version))
        .where(where)
        .orderBy(desc(SubmissionTable.createdAt))
        .limit(limit)
        .offset(Math.max(query.offset ?? 0, 0)),
      db.select({total: count()}).from(SubmissionTable).where(where)
    ])
    return {submissions: rows as Array<Submission>, total: Number(total)}
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

  async notifiedSubmission(
    entryId: string,
    id: string,
    notified: Array<string>
  ): Promise<void> {
    const db = await this.#db
    await db
      .update(SubmissionTable)
      .set({notified})
      .where(
        and(eq(SubmissionTable.entryId, entryId), eq(SubmissionTable.id, id))
      )
  }

  async retainSubmissions(
    entryId: string,
    seconds: number | null
  ): Promise<void> {
    const db = await this.#db
    await db
      .update(SubmissionTable)
      .set({
        expiresAt:
          seconds === null
            ? null
            : sql<number>`${SubmissionTable.createdAt} + ${seconds}`
      })
      .where(eq(SubmissionTable.entryId, entryId))
  }

  async deleteSubmission(
    entryId: string,
    id?: string
  ): Promise<Array<FormFileKey>> {
    const db = await this.#db
    const files = and(
      eq(FileTable.entryId, entryId),
      id === undefined ? undefined : eq(FileTable.submissionId, id)
    )
    const kept = await keptOutside(db, files)
    await db.delete(FileTable).where(files)
    await db
      .delete(SubmissionTable)
      .where(
        and(
          eq(SubmissionTable.entryId, entryId),
          id === undefined ? undefined : eq(SubmissionTable.id, id)
        )
      )
    if (id === undefined)
      await db.delete(VersionTable).where(eq(VersionTable.entryId, entryId))
    return kept
  }

  async purgeSubmissions(now: number): Promise<Array<FormFileKey>> {
    const db = await this.#db
    const expired = db
      .select(SubmissionTable.id)
      .from(SubmissionTable)
      .where(lt(SubmissionTable.expiresAt, now))
    const files = or(
      inArray(FileTable.submissionId, expired),
      and(
        isNull(FileTable.submissionId),
        lt(FileTable.createdAt, now - pendingFor)
      )
    )
    const kept = await keptOutside(db, files)
    await db.delete(FileTable).where(files)
    await db.delete(SubmissionTable).where(lt(SubmissionTable.expiresAt, now))
    return kept
  }

  async visitorActivity(
    entryId: string,
    visitor: string,
    since: number
  ): Promise<{submissions: number; files: number}> {
    const db = await this.#db
    const [[submissions], [files]] = await Promise.all([
      db
        .select({count: count()})
        .from(SubmissionTable)
        .where(
          and(
            eq(SubmissionTable.visitor, visitor),
            eq(SubmissionTable.entryId, entryId),
            gte(SubmissionTable.createdAt, since)
          )
        ),
      db
        .select({count: count()})
        .from(FileTable)
        .where(
          and(
            eq(FileTable.visitor, visitor),
            eq(FileTable.entryId, entryId),
            gte(FileTable.createdAt, since)
          )
        )
    ])
    return {
      submissions: Number(submissions.count),
      files: Number(files.count)
    }
  }

  async storeFormFile(file: StoredFormFile): Promise<void> {
    const db = await this.#db
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

/** Search text as it is matched, the wildcards of like are left out */
function searchPattern(search: string): string {
  return search
    .trim()
    .toLowerCase()
    .replace(/[%_\\]/g, '')
}

function statusCondition(status: NonNullable<SubmissionQuery['status']>) {
  if (status === 'all') return undefined
  if (status === 'open') return ne(SubmissionTable.status, 'archived')
  return eq(SubmissionTable.status, status)
}

/** The files matching a condition that are kept outside the database */
async function keptOutside(
  db: Database,
  where: ReturnType<typeof and>
): Promise<Array<FormFileKey>> {
  return db
    .select({entryId: FileTable.entryId, id: FileTable.id})
    .from(FileTable)
    .where(and(where, isNull(FileTable.content)))
}

async function definitionHash(
  entryId: string,
  definition: unknown
): Promise<string> {
  const data = new TextEncoder().encode(
    `${entryId}:${JSON.stringify(definition)}`
  )
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
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
