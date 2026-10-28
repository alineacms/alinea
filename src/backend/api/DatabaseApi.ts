import type {
  DraftsApi,
  LocksApi,
  RequestContext,
  UploadResponse,
  UploadsApi,
  UserApi
} from '#/core/Connection.js'
import {type Draft, type DraftKey} from '#/core/Draft.js'
import {
  type EditLock,
  type EditStatus,
  type Heartbeat,
  lockExpires,
  lockKey,
  nextLock
} from '#/core/EditLock.js'
import {createId} from '#/core/Id.js'
import type {User, UserInput} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {basename, extname} from '#/core/util/Paths.js'
import {chunks} from '#/core/util/Arrays.js'
import {slugify} from '#/core/util/Slugs.js'
import PLazy from 'p-lazy'
import {
  and,
  Builder,
  Column,
  ColumnType,
  type Database,
  eq,
  inArray,
  include,
  lt,
  sql,
  table
} from 'rado'
import * as column from 'rado/universal/columns'
import {HandleAction} from '../HandleAction.js'
import type {BlobStore} from './BlobStore.js'

export interface DatabaseOptions {
  db: Database
}

const UploadTable = table('alinea_upload', {
  entryId: column.varchar(undefined, {length: 27}).primaryKey(),
  content: largeBlob().notNull()
})

const UserTable = table('alinea_user', {
  id: column.id(),
  email: indexedText().notNull().unique(),
  name: column.text()
})

const UserRoleTable = table('alinea_user_role', {
  userId: column.integer().notNull().references(UserTable.id),
  role: column.text().notNull()
})

/** Content blobs every handler instance reads, see `BlobStore`. */
const BlobTable = table('alinea_blob', {
  sha: column.varchar(undefined, {length: 40}).primaryKey(),
  content: largeBlob().notNull(),
  /** When the blob was last stored or read, in seconds */
  usedAt: column.integer().notNull()
})

/** Who is editing which entry, see `EditLock` */
const LockTable = table('alinea_lock', {
  key: column.varchar(undefined, {length: 64}).primaryKey(),
  lock: column.json<EditLock>().notNull(),
  /** In seconds */
  expiresAt: column.integer().notNull()
})

const tables = [UploadTable, UserTable, UserRoleTable, BlobTable, LockTable]

/** Parameters bound per statement: D1 allows 100, the fewest of all drivers. */
const maxParams = 100
/** Shas per select or update, which bind a few parameters besides them. */
const blobsPerStatement = 50
/** Rows per insert, each binding its sha, content and usedAt. */
const blobsPerInsert = Math.floor(maxParams / 3)
const day = 24 * 60 * 60
/** Blobs no instance read or stored for this long are removed. */
const blobRetention = 30 * day
/** The last removal of unused blobs, per database, in seconds. */
const blobCleanups = new WeakMap<Database, number>()
const preparedDatabases = new WeakMap<Database, Promise<Database>>()

const selectUser = {
  ...UserTable,
  roles: include(
    new Builder()
      .select(UserRoleTable.role)
      .from(UserRoleTable)
      .where(eq(UserRoleTable.userId, UserTable.id))
  )
}

export class DatabaseApi
  implements DraftsApi, LocksApi, UploadsApi, UserApi, BlobStore
{
  #context: RequestContext
  #db: Promise<Database>

  constructor(context: RequestContext, {db}: DatabaseOptions) {
    this.#context = context
    this.#db = prepareDatabase(db)
  }

  async getDraft(draftKey: DraftKey): Promise<Draft | undefined> {
    throw new Error('Not longer supported')
  }

  async storeDraft(draft: Draft): Promise<void> {
    throw new Error('Not longer supported')
  }

  // Not in a transaction, which D1 lacks: a heartbeat lost to a concurrent
  // one is repeated by the next
  async heartbeat(beat: Heartbeat, user: User): Promise<EditStatus> {
    const db = await this.#db
    const now = Date.now()
    const key = lockKey(beat)
    await db.delete(LockTable).where(lt(LockTable.expiresAt, seconds()))
    const row = await db
      .select(LockTable.lock)
      .from(LockTable)
      .where(eq(LockTable.key, key))
      .get()
    const [lock, status] = nextLock(row ?? undefined, beat, user, now)
    await db.delete(LockTable).where(eq(LockTable.key, key))
    if (lock) {
      const expiresAt = Math.ceil(lockExpires(lock) / 1000)
      await db.insert(LockTable).values({key, lock, expiresAt})
    }
    return status
  }

  async prepareUpload(file: string): Promise<UploadResponse> {
    const ctx = this.#context
    const entryId = createId()
    const extension = extname(file)
    const base = basename(file, extension)
    const filename = [slugify(base), entryId, slugify(extension)].join('.')
    const url = new URL(
      `?${new URLSearchParams({
        action: HandleAction.Upload,
        entryId
      })}`,
      ctx.handlerUrl
    )
    return {
      entryId,
      location: filename,
      previewUrl: url.href,
      url: url.href
    }
  }

  async handleUpload(entryId: string, file: Blob): Promise<void> {
    const db = await this.#db
    const content = new Uint8Array(await file.arrayBuffer())
    await db.insert(UploadTable).values({
      entryId,
      content
    })
  }

  async previewUpload(entryId: string): Promise<Response> {
    const db = await this.#db
    const upload = await db
      .select()
      .from(UploadTable)
      .where(eq(UploadTable.entryId, entryId))
      .get()
    if (!upload) return new Response('Not found', {status: 404})
    return new Response(upload.content as BodyInit, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `inline; filename="${entryId}"`
      }
    })
  }

  async readBlobs(
    shas: ReadonlyArray<string>
  ): Promise<Map<string, Uint8Array>> {
    const db = await this.#db
    const found = new Map<string, Uint8Array>()
    for (const batch of chunks(shas, blobsPerStatement)) {
      const rows = await db
        .select({sha: BlobTable.sha, content: BlobTable.content})
        .from(BlobTable)
        .where(inArray(BlobTable.sha, batch))
      for (const row of rows) found.set(row.sha, row.content)
    }
    const now = seconds()
    for (const batch of chunks([...found.keys()], blobsPerStatement))
      await renewBlobs(db, batch, now)
    await removeUnusedBlobs(db, now)
    return found
  }

  async storeBlobs(
    blobs: ReadonlyArray<[sha: string, blob: Uint8Array]>
  ): Promise<void> {
    const db = await this.#db
    const now = seconds()
    const unique = [...new Map(blobs)]
    for (const batch of chunks(unique, blobsPerInsert)) {
      const shas = batch.map(([sha]) => sha)
      const stored = new Set(
        await db
          .select(BlobTable.sha)
          .from(BlobTable)
          .where(inArray(BlobTable.sha, shas))
      )
      await renewBlobs(db, [...stored], now)
      const rows = batch
        .filter(([sha]) => !stored.has(sha))
        .map(([sha, content]) => ({sha, content, usedAt: now}))
      if (rows.length === 0) continue
      await db
        .insert(BlobTable)
        .values(rows)
        .catch(() => insertMissingBlobs(db, rows))
    }
    await removeUnusedBlobs(db, now)
  }

  async enrichUser(user: User): Promise<User> {
    const normalized = normalizeUser(user)
    const found = await this.#getUser(normalized.email)
    if (!found) return {...normalized, sub: normalized.sub ?? normalized.email}
    return {...normalized, ...found}
  }

  async listUsers(): Promise<Array<User>> {
    const db = await this.#db
    const users = await db.select(selectUser).from(UserTable)
    return users.map(userFromRow)
  }

  async createUser(user: UserInput): Promise<User> {
    const normalized = normalizeUser(user)
    const db = await this.#db
    const existing = await this.#getUser(normalized.email)
    if (existing) return this.updateUser(normalized)
    await db.transaction(async tx => {
      await tx.insert(UserTable).values({
        email: normalized.email,
        name: normalized.name
      })
      const inserted = await tx
        .select()
        .from(UserTable)
        .where(eq(UserTable.email, normalized.email))
        .get()
      assert(inserted, `Failed to insert user`)
      await this.#replaceRoles(tx, inserted.id, normalized.roles ?? [])
    })
    const result = await this.#getUser(normalized.email)
    assert(result, `Failed to retrieve user after creation`)
    return result
  }

  async updateUser(user: UserInput): Promise<User> {
    const normalized = normalizeUser(user)
    const db = await this.#db
    await db.transaction(async tx => {
      const row = await tx
        .select()
        .from(UserTable)
        .where(eq(UserTable.email, normalized.email))
        .get()
      assert(row, `User with email ${normalized.email} not found`)
      await tx
        .update(UserTable)
        .set({
          email: normalized.email,
          name: normalized.name
        })
        .where(eq(UserTable.id, row.id))
      await this.#replaceRoles(tx, row.id, normalized.roles ?? [])
    })
    const updatedUser = await this.#getUser(normalized.email)
    assert(updatedUser, `Failed to retrieve user after update`)
    return updatedUser
  }

  async removeUser(email: string): Promise<void> {
    const normalized = normalizeEmail(email)
    const db = await this.#db
    await db.transaction(async tx => {
      const row = await tx
        .select()
        .from(UserTable)
        .where(eq(UserTable.email, normalized))
        .get()
      assert(row, `User with email ${normalized} not found`)
      await tx.delete(UserRoleTable).where(eq(UserRoleTable.userId, row.id))
      await tx.delete(UserTable).where(eq(UserTable.id, row.id))
    })
  }

  async #getUser(email: string): Promise<User | undefined> {
    const db = await this.#db
    const user = await db
      .select(selectUser)
      .from(UserTable)
      .where(eq(UserTable.email, email))
      .get()
    if (user) return userFromRow(user)
    return undefined
  }

  async #replaceRoles(
    db: Database,
    userId: number,
    roles: Array<string>
  ): Promise<void> {
    const uniqueRoles = Array.from(new Set(roles))
    await db.delete(UserRoleTable).where(eq(UserRoleTable.userId, userId))
    if (uniqueRoles.length === 0) return
    await db.insert(UserRoleTable).values(
      uniqueRoles.map(role => {
        return {userId, role}
      })
    )
  }
}

function prepareDatabase(db: Database): Promise<Database> {
  const existing = preparedDatabases.get(db)
  if (existing) return existing
  const prepared = PLazy.from(async () => {
    await db.migrate(...tables)
    // Enable RLS so our tables are not exposed to the world if a user puts
    // this in Supabase.
    await enablePostgresRowLevelSecurity(db)
    return db
  })
  preparedDatabases.set(db, prepared)
  return prepared
}

/** A blob of any size: a plain MySQL blob holds 64 KB at most. */
function largeBlob(): Column<Uint8Array> {
  return new Column({
    type: new ColumnType(
      'blob',
      [],
      sql.universal({
        postgres: sql`bytea`,
        mysql: sql`longblob`,
        default: sql`blob`
      })
    ),
    mapFromDriverValue(value) {
      return new Uint8Array(value as ArrayBufferLike)
    }
  })
}

/**
 * Text MySQL can index: it rejects a unique key on a text column, which has
 * no length. Other databases keep text, so existing tables stay as they are.
 */
function indexedText(): Column<string> {
  return new Column({
    type: new ColumnType(
      'text',
      [],
      sql.universal({
        mysql: sql`varchar(255)`,
        default: sql`text`
      })
    )
  })
}

/** Blobs still used are kept: renewed at most once a day per blob. */
async function renewBlobs(
  db: Database,
  shas: Array<string>,
  now: number
): Promise<void> {
  if (shas.length === 0) return
  await db
    .update(BlobTable)
    .set({usedAt: now})
    .where(and(inArray(BlobTable.sha, shas), lt(BlobTable.usedAt, now - day)))
}

interface BlobRow {
  sha: string
  content: Uint8Array
  usedAt: number
}

/**
 * Another instance can store some of the same blobs between our select and
 * insert, which fails the whole insert: retry per blob, skipping those now
 * stored and failing on anything else.
 */
async function insertMissingBlobs(
  db: Database,
  rows: Array<BlobRow>
): Promise<void> {
  for (const row of rows) {
    try {
      await db.insert(BlobTable).values(row)
    } catch (error) {
      const stored = await db
        .select(BlobTable.sha)
        .from(BlobTable)
        .where(eq(BlobTable.sha, row.sha))
        .get()
      if (!stored) throw error
    }
  }
}

/** Remove blobs no instance read or stored lately, at most once an hour. */
async function removeUnusedBlobs(db: Database, now: number): Promise<void> {
  const last = blobCleanups.get(db) ?? 0
  if (now - last < 60 * 60) return
  blobCleanups.set(db, now)
  await db.delete(BlobTable).where(lt(BlobTable.usedAt, now - blobRetention))
}

function seconds(): number {
  return Math.floor(Date.now() / 1000)
}

async function enablePostgresRowLevelSecurity(db: Database): Promise<void> {
  if (db.dialect.runtime !== 'postgres') return
  for (const table of tables) {
    await db.run(sql`alter table ${table} enable row level security`)
  }
}

interface UserRow {
  id: number
  email: string
  name: string | null
  roles: Array<string>
}

function userFromRow(row: UserRow): User {
  return {
    ...row,
    sub: row.email,
    name: row.name ?? undefined
  }
}

interface NormalizedDatabaseUser extends UserInput {
  email: string
}

function normalizeUser(user: UserInput): NormalizedDatabaseUser {
  const email = normalizeEmail(user.email)
  const name = user.name?.trim() || undefined
  const roles = Array.from(new Set(user.roles ?? []))
  return {
    sub: user.sub,
    email,
    name,
    roles
  }
}

function normalizeEmail(email: string | undefined): string {
  assert(email, 'User email is required')
  const normalized = email.trim().toLowerCase()
  assert(normalized, 'User email is required')
  return normalized
}
