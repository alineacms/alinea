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
  type HasSql,
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  index,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
  table,
  uniqueIndex
} from 'rado'
import * as column from 'rado/universal/columns'
import {sha256} from '#/core/util/ContentHash.js'
import {entries} from '#/core/util/Objects.js'
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
    index('alinea_submission_file_by_entry').on(row.entryId, row.createdAt),
    index('alinea_submission_file_by_time').on(row.createdAt)
  ]
)

/** The answers to unique inputs, a form takes each of them once */
const AnswerTable = table(
  'alinea_submission_answer',
  {
    entryId: column.varchar(undefined, {length: 27}).notNull(),
    // A hash of the input and its answer, which keeps the index short
    answer: column.varchar(undefined, {length: 64}).notNull(),
    input: column.text().notNull(),
    submissionId: column.varchar(undefined, {length: 27}).notNull()
  },
  row => [
    uniqueIndex('alinea_submission_answer_by_entry').on(
      row.entryId,
      row.answer
    ),
    index('alinea_submission_answer_by_submission').on(row.submissionId)
  ]
)

const tables = [VersionTable, SubmissionTable, FileTable, AnswerTable]

/** Files that were uploaded but not submitted are removed after this long */
const pendingFor = 24 * 60 * 60

const pageSize = 50
const maxPageSize = 500

const prepared = new WeakMap<Database, Promise<Database>>()

/** Keeps the submissions of forms and their files in the backend database */
export class SubmissionStore implements SubmissionsApi {
  #db: Promise<Database>

  constructor({db}: SubmissionStoreOptions) {
    // Returning the lazy migration from then() would start it right away
    this.#db = PLazy.from(() => Promise.resolve(db).then(prepare))
  }

  async storeSubmission({
    definition,
    unique = {},
    ...submission
  }: StoredSubmission): Promise<Array<string>> {
    const db = await this.#db
    const {id, entryId} = submission
    const answers = await Promise.all(
      entries(unique).map(async ([input, value]) => ({
        entryId,
        answer: await sha256(`${input}:${value}`),
        input,
        submissionId: id
      }))
    )
    const sent = async () => {
      if (answers.length === 0) return []
      const rows = await db
        .select(AnswerTable.input)
        .from(AnswerTable)
        .where(
          and(
            eq(AnswerTable.entryId, entryId),
            inArray(
              AnswerTable.answer,
              answers.map(row => row.answer)
            )
          )
        )
      return [...new Set(rows)]
    }
    const before = await sent()
    if (before.length > 0) return before
    const version = await sha256(`${entryId}:${JSON.stringify(definition)}`)
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
    if (answers.length === 0) return []
    // The index refuses an answer another submission stored meanwhile
    try {
      await db.insert(AnswerTable).values(answers)
      return []
    } catch (error) {
      await db.delete(SubmissionTable).where(eq(SubmissionTable.id, id))
      const meanwhile = await sent()
      if (meanwhile.length > 0) return meanwhile
      throw error
    }
  }

  async listSubmissions(
    entryId: string,
    query: SubmissionQuery = {}
  ): Promise<SubmissionPage> {
    const db = await this.#db
    const where = and(
      eq(SubmissionTable.entryId, entryId),
      query.id ? eq(SubmissionTable.id, query.id) : undefined,
      statusCondition(query.status ?? 'all'),
      query.locale ? eq(SubmissionTable.locale, query.locale) : undefined,
      query.locales && inLocales(query.locales),
      query.from !== undefined
        ? gte(SubmissionTable.createdAt, query.from)
        : undefined,
      query.until !== undefined
        ? lt(SubmissionTable.createdAt, query.until)
        : undefined,
      // Those that expired are gone, also before they are purged
      or(
        isNull(SubmissionTable.expiresAt),
        gte(SubmissionTable.expiresAt, Math.floor(Date.now() / 1000))
      ),
      query.choice
        ? contains(
            SubmissionTable.choices,
            choiceText(query.choice.key, query.choice.value)
          )
        : undefined,
      query.search?.trim()
        ? contains(SubmissionTable.search, query.search.trim().toLowerCase())
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
    const row = SubmissionTable
    const expiresAt =
      seconds === null ? null : sql<number>`${row.createdAt} + ${seconds}`
    // Only rows that expire otherwise, so nothing is written until the form
    // keeps its submissions for another time
    await db
      .update(row)
      .set({expiresAt})
      .where(
        and(
          eq(row.entryId, entryId),
          expiresAt === null
            ? isNotNull(row.expiresAt)
            : or(isNull(row.expiresAt), ne(row.expiresAt, expiresAt))
        )
      )
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
      .delete(AnswerTable)
      .where(
        and(
          eq(AnswerTable.entryId, entryId),
          id === undefined ? undefined : eq(AnswerTable.submissionId, id)
        )
      )
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
    await db
      .delete(AnswerTable)
      .where(inArray(AnswerTable.submissionId, expired))
    await db.delete(SubmissionTable).where(lt(SubmissionTable.expiresAt, now))
    return kept
  }

  async recentActivity(
    entryId: string,
    since: number,
    kind: 'submissions' | 'files',
    visitor?: string
  ): Promise<{form: number; visitor: number}> {
    const db = await this.#db
    const row = kind === 'submissions' ? SubmissionTable : FileTable
    const [counts] = await db
      .select({
        form: count(),
        visitor: sql<number>`sum(case when ${row.visitor} = ${visitor ?? null} then 1 else 0 end)`
      })
      .from(row)
      .where(and(eq(row.entryId, entryId), gte(row.createdAt, since)))
    return {form: Number(counts.form), visitor: Number(counts.visitor ?? 0)}
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
  ): Promise<Array<string>> {
    if (ids.length === 0) return []
    const db = await this.#db
    const files = and(
      eq(FileTable.entryId, entryId),
      inArray(FileTable.id, ids)
    )
    // Only a file no submission has yet, so one sent twice at once goes to
    // one of them
    await db
      .update(FileTable)
      .set({submissionId})
      .where(and(files, isNull(FileTable.submissionId)))
    return db
      .select(FileTable.id)
      .from(FileTable)
      .where(and(files, eq(FileTable.submissionId, submissionId)))
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

function inLocales(locales: Array<string | null>) {
  const named = locales.filter(locale => locale !== null)
  return or(
    named.length > 0 ? inArray(SubmissionTable.locale, named) : undefined,
    locales.includes(null) ? isNull(SubmissionTable.locale) : undefined,
    // No language at all matches nothing
    sql<boolean>`1 = 0`
  )
}

/** A text column that contains the text, its wildcards matched as they are */
function contains(column: HasSql<string>, text: string): HasSql<boolean> {
  const pattern = `%${text.replace(/[!%_]/g, '!$&')}%`
  return sql<boolean>`${column} like ${pattern} escape '!'`
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
