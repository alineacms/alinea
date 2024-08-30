import {Drafts, Media, Pending, Target} from 'alinea/backend'
import {Mutation} from 'alinea/core/Mutation'
import PLazy from 'p-lazy'
import {asc, Database, eq, lt, table} from 'rado'
import {txGenerator} from 'rado/universal'
import * as column from 'rado/universal/columns'

export interface DatabaseOptions {
  db: Database
  target: Target
}

const Draft = table('alinea_draft', {
  entryId: column.text().primaryKey(),
  fileHash: column.text().notNull(),
  draft: column.blob().notNull()
})

const Mutation = table('alinea_mutation', {
  id: column.id(),
  commitHash: column.text().unique().notNull(),
  mutations: column.jsonb<Array<Mutation>>().notNull()
})

export function databaseApi(options: DatabaseOptions) {
  const setup = PLazy.from(async () => {
    const {db} = options
    await db.create(Draft, Mutation).run()
    return options.db
  })
  const drafts: Drafts = {
    async get(ctx, entryId) {
      const db = await setup
      const found = await db
        .select()
        .from(Draft)
        .where(eq(Draft.entryId, entryId))
        .get()
      return found ?? undefined
    },
    async store(ctx, draft) {
      const db = await setup
      return db.transaction(
        txGenerator(function* (tx) {
          const [existing] = yield* tx
            .select()
            .from(Draft)
            .where(eq(Draft.entryId, draft.entryId))
          yield* existing
            ? tx
                .update(Draft)
                .set(draft)
                .where(eq(Draft.entryId, draft.entryId))
            : tx.insert(Draft).values(draft)
        })
      )
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
        .where(lt(Mutation.id, index ?? 0))
        .orderBy(asc(Mutation.id))
      if (rows.length === 0) return undefined
      const mutations = rows.flatMap(row => row.mutations)
      return {toCommitHash: rows[rows.length - 1].commitHash, mutations}
    }
  }
  const media: Media = {
    async upload(ctx, file) {
      throw new Error('Not implemented')
    }
  }
  return {drafts, target, pending, media}
}
