import type {Drafts, Media, Pending, Target} from 'alinea/backend/Backend'
import {parseDraftKey} from 'alinea/core/Draft'
import {createId} from 'alinea/core/Id'
import type {Mutation} from 'alinea/core/Mutation'
import {basename, extname} from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import PLazy from 'p-lazy'
import {asc, type Database, eq, gt, primaryKey, table} from 'rado'
import type {IsMysql, IsPostgres, IsSqlite} from 'rado/core/MetaData.js'
import * as column from 'rado/universal/columns'
import {HandleAction} from '../HandleAction.js'
import {is} from '../util/ORM.js'

export interface DatabaseOptions {
  db: Database
  target: Target
}

const Draft = table(
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

const Mutation = table('alinea_mutation', {
  id: column.id(),
  commitHash: column.text().unique().notNull(),
  mutations: column.jsonb<Array<Mutation>>().notNull()
})

const Upload = table('alinea_upload', {
  entryId: column.text().primaryKey(),
  content: column.blob().notNull()
})

export function databaseApi(options: DatabaseOptions) {
  const setup = PLazy.from(async () => {
    const {db} = options
    await db.create(Draft, Mutation, Upload).catch(() => {})
    return options.db
  })
  const drafts: Drafts = {
    async get(ctx, key) {
      const {entryId, locale} = parseDraftKey(key)
      const db = await setup
      const found = await db
        .select()
        .from(Draft)
        .where(eq(Draft.entryId, entryId), is(Draft.locale, locale))
        .get()
      return found ?? undefined
    },
    async store(ctx, draft) {
      const db = await setup
      const query =
        db.dialect.runtime === 'mysql'
          ? (<Database<IsMysql>>db)
              .insert(Draft)
              .values(draft)
              .onDuplicateKeyUpdate({
                set: draft
              })
          : (<Database<IsPostgres | IsSqlite>>db)
              .insert(Draft)
              .values(draft)
              .onConflictDoUpdate({
                target: Draft.entryId,
                set: draft
              })
      await query
    }
  }
  const target: Target = {
    async mutate(ctx, params) {
      const db = await setup
      const {commitHash} = await options.target.mutate(ctx, params)
      const mutations = params.mutations.map(m => m.meta)
      await db.insert(Mutation).values({commitHash, mutations})
      return {commitHash}
    }
  }
  const pending: Pending = {
    async since(ctx, commitHash) {
      const db = await setup
      const index = await db
        .select(Mutation.id)
        .from(Mutation)
        .where(eq(Mutation.commitHash, commitHash))
        .get()
      const rows = await db
        .select()
        .from(Mutation)
        .where(gt(Mutation.id, index ?? 0))
        .orderBy(asc(Mutation.id))
      if (rows.length === 0) return undefined
      const mutations = rows.flatMap(row => row.mutations)
      return {toCommitHash: rows[rows.length - 1].commitHash, mutations}
    }
  }
  const media: Media = {
    async prepareUpload(ctx, file) {
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
    },
    async handleUpload(ctx, entryId, file) {
      const db = await setup
      const content = new Uint8Array(await file.arrayBuffer())
      await db.insert(Upload).values({
        entryId,
        content
      })
    },
    async previewUpload(ctx, entryId) {
      const db = await setup
      const upload = await db
        .select()
        .from(Upload)
        .where(eq(Upload.entryId, entryId))
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
  return {drafts, target, pending, media}
}
