import type {
  DraftsApi,
  RequestContext,
  UploadResponse,
  UploadsApi,
  UserApi
} from '#/core/Connection.js'
import {type Draft, type DraftKey, parseDraftKey} from '#/core/Draft.js'
import {createId} from '#/core/Id.js'
import type {User, UserInput} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {basename, extname} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import PLazy from 'p-lazy'
import {Builder, type Database, eq, include, primaryKey, table} from 'rado'
import type {IsMysql, IsPostgres, IsSqlite} from 'rado/core/MetaData'
import * as column from 'rado/universal/columns'
import {HandleAction} from '../HandleAction.js'
import {is} from '../util/ORM.js'

export interface DatabaseOptions {
  db: Database
}

const DraftTable = table(
  'alinea_draft',
  {
    entryId: column.text().notNull(),
    locale: column.text(),
    fileHash: column.text().notNull(),
    draft: column.blob().notNull()
  },
  Draft => {
    return {
      primary: primaryKey(Draft.entryId, Draft.locale)
    }
  }
)

const UploadTable = table('alinea_upload', {
  entryId: column.text().primaryKey(),
  content: column.blob().notNull()
})

const UserTable = table('alinea_user', {
  id: column.id(),
  email: column.text().notNull().unique(),
  name: column.text()
})

const UserRoleTable = table('alinea_user_role', {
  userId: column.number().notNull().references(UserTable.id),
  role: column.text().notNull()
})

const selectUser = {
  ...UserTable,
  roles: include(
    new Builder()
      .select(UserRoleTable.role)
      .from(UserRoleTable)
      .where(eq(UserRoleTable.userId, UserTable.id))
  )
}

export class DatabaseApi implements DraftsApi, UploadsApi, UserApi {
  #context: RequestContext
  #db: Promise<Database>

  constructor(context: RequestContext, {db}: DatabaseOptions) {
    this.#context = context
    this.#db = PLazy.from(async () => {
      await db.migrate(DraftTable, UploadTable, UserTable, UserRoleTable)
      return db
    })
  }

  async getDraft(draftKey: DraftKey): Promise<Draft | undefined> {
    const db = await this.#db
    const {entryId, locale} = parseDraftKey(draftKey)
    const found = await db
      .select()
      .from(DraftTable)
      .where(eq(DraftTable.entryId, entryId), is(DraftTable.locale, locale))
      .get()
    return found ?? undefined
  }

  async storeDraft(draft: Draft): Promise<void> {
    const db = await this.#db
    const query =
      db.dialect.runtime === 'mysql'
        ? (<Database<IsMysql>>db)
            .insert(DraftTable)
            .values(draft)
            .onDuplicateKeyUpdate({
              set: draft
            })
        : (<Database<IsPostgres | IsSqlite>>db)
            .insert(DraftTable)
            .values(draft)
            .onConflictDoUpdate({
              target: DraftTable.entryId,
              set: draft
            })
    await query
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
