import type {RequestContext} from 'alinea/core/Connection'
import type {
  DraftsApi,
  UploadResponse,
  UploadsApi
} from 'alinea/core/Connection'
import {type Draft, type DraftKey, parseDraftKey} from 'alinea/core/Draft'
import {createId} from 'alinea/core/Id'
import {basename, extname} from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import PLazy from 'p-lazy'
import {type Database, eq, primaryKey, table} from 'rado'
import type {IsMysql, IsPostgres, IsSqlite} from 'rado/core/MetaData.js'
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

export class DatabaseApi implements DraftsApi, UploadsApi {
  #db: Promise<Database>
  constructor({db}: DatabaseOptions) {
    this.#db = PLazy.from(async () => {
      await db.create(DraftTable, UploadTable).catch(() => {})
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

  async prepareUpload(
    file: string,
    ctx: RequestContext
  ): Promise<UploadResponse> {
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
    return new Response(upload.content, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `inline; filename="${entryId}"`
      }
    })
  }
}
