import type {
  DraftsApi,
  RequestContext,
  UploadResponse,
  UploadsApi,
  UserApi
} from '#/core/Connection.js'
import {type Draft, type DraftKey, parseDraftKey} from '#/core/Draft.js'
import {createId} from '#/core/Id.js'
import type {User} from '#/core/User.js'
import {basename, extname} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import PLazy from 'p-lazy'
import {type Database, eq, InferSelectModel, primaryKey, table} from 'rado'
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
  sub: column.text().primaryKey(),
  email: column.text().notNull().unique(),
  name: column.text()
})

const UserRoleTable = table('alinea_user_role', {
  userId: column.text().notNull().references(UserTable.sub),
  role: column.text().notNull()
})

export class DatabaseApi implements DraftsApi, UploadsApi, UserApi {
  #context: RequestContext
  #db: Promise<Database>

  constructor(context: RequestContext, {db}: DatabaseOptions) {
    this.#context = context
    this.#db = PLazy.from(async () => {
      await db
        .create(DraftTable, UploadTable, UserTable, UserRoleTable)
        .catch(() => {})
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
    const found = await this.#getUser(user.sub)
    if (!found) return user
    return {...user, ...found}
  }

  async listUsers(): Promise<Array<User>> {
    const db = await this.#db
    const users = await db.select().from(UserTable)
    return Promise.all(users.map(user => this.#toUser(user)))
  }

  async createUser(user: User): Promise<User> {
    const db = await this.#db
    await db.transaction(async tx => {
      await tx.insert(UserTable).values(user)
      await this.#replaceRoles(tx, user.sub, user.roles ?? [])
    })
    return (await this.#getUser(user.sub)) ?? user
  }

  async updateUser(user: User): Promise<User> {
    const db = await this.#db
    const found = await this.#getUser(user.sub)
    if (!found) return this.createUser(user)
    await db.transaction(async tx => {
      await tx.update(UserTable).set(user).where(eq(UserTable.sub, user.sub))
      await this.#replaceRoles(tx, user.sub, user.roles ?? [])
    })
    return (await this.#getUser(user.sub)) ?? user
  }

  async #getUser(sub: string): Promise<User | undefined> {
    const db = await this.#db
    const user = await db
      .select()
      .from(UserTable)
      .where(eq(UserTable.sub, sub))
      .get()
    if (!user) return undefined
    return this.#toUser(user)
  }

  async #toUser(user: InferSelectModel<typeof UserTable>): Promise<User> {
    const db = await this.#db
    const roles = await db
      .select()
      .from(UserRoleTable)
      .where(eq(UserRoleTable.userId, user.sub))
    return {
      sub: user.sub,
      name: user.name ?? undefined,
      email: user.email,
      roles: roles.map(role => role.role)
    }
  }

  async #replaceRoles(
    db: Database,
    userId: string,
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
