import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  type HasSql,
  inArray,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  or,
  sql,
  type SyncDatabase
} from 'rado'
import {index, integer, sqliteTable, text, uniqueIndex} from 'rado/sqlite'
import {assert} from '../util/Assert.js'

/**
 * A generic, synchronous document database backed by SQLite.
 *
 * Concepts the engine knows about:
 * - documents: JSON data addressed by (id, variant)
 * - hierarchy: documents form a tree through their `parent` id
 * - edges: links from anywhere inside a document to another document id
 * - search: optional full text search over caller-provided text
 *
 * The engine knows nothing about CMS semantics: the caller provides link
 * extraction and searchable text through {@link DocDBOptions}.
 */

const NO_VARIANT = ''
const ANCESTRY_CEILING = '\uffff'

// rado types sync driver results as `Result | Promise<Result>` because
// `Sync` structurally extends `Either` in its Deliver conditional. Unwrap
// with a runtime check until that is fixed upstream.
function syncResult<T>(value: T | Promise<T>): T {
  if (value instanceof Promise) throw new Error('Expected a sync result')
  return value
}

export interface DocLink {
  /** Dotted json path of where the link lives inside the document */
  path: string
  /** The id of the target document */
  id: string
}

export interface DocInput {
  id: string
  parent?: string | null
  variant?: string | null
  data: Record<string, unknown>
}

export interface Doc extends DocInput {
  parent: string | null
  variant: string | null
  level: number
}

export interface DocSearchText {
  title?: string
  body?: string
}

export interface DocDBOptions {
  /** Extract outgoing links from document data (used for the edge index) */
  extractLinks?(data: Record<string, unknown>): Iterable<DocLink>
  /** Extract searchable text from document data (used for full text search) */
  searchableText?(data: Record<string, unknown>): DocSearchText | undefined
  /** Dotted json paths that receive an expression index, eg. `["type", "fields.author"]` */
  indexPaths?: Array<string>
}

export interface DocFieldCondition {
  /** Dotted json path into the document data, eg. `"type"` or `"fields.author"` */
  path: string
  eq?: unknown
  ne?: unknown
  gt?: unknown
  gte?: unknown
  lt?: unknown
  lte?: unknown
  in?: Array<unknown>
  like?: string
  isNull?: boolean
}

export type DocCondition =
  | {and: Array<DocCondition>}
  | {or: Array<DocCondition>}
  | DocFieldCondition

export interface DocOrder {
  path: string
  desc?: boolean
}

export interface DocQuery {
  id?: string | Array<string>
  variant?: string | null | Array<string | null>
  parent?: string | null
  /** Select all documents in the subtree of the given id (excluding itself) */
  descendantOf?: string
  level?: number | {gt?: number; gte?: number; lt?: number; lte?: number}
  /** Filter on document properties */
  where?: DocCondition
  /** Full text search, results are returned by relevance */
  search?: string
  /** Select documents that link to the given id */
  linksTo?: string
  orderBy?: Array<DocOrder>
  skip?: number
  take?: number
}

export interface DocReference {
  /** The document holding the link */
  id: string
  variant: string | null
  /** Dotted json path of the link inside the source document */
  path: string
  /** The link target */
  target: string
}

const DocTable = sqliteTable(
  'doc',
  {
    uid: integer().primaryKey({autoIncrement: true}),
    id: text().notNull(),
    parent: text(),
    variant: text().notNull().default(NO_VARIANT),
    ancestry: text().notNull(),
    level: integer().notNull(),
    data: text('data', {mode: 'json'})
      .$type<Record<string, unknown>>()
      .notNull()
  },
  DocTable => {
    return {
      idVariant: uniqueIndex().on(DocTable.id, DocTable.variant),
      byParent: index().on(DocTable.parent),
      byAncestry: index().on(DocTable.ancestry)
    }
  }
)

const EdgeTable = sqliteTable(
  'edge',
  {
    fromUid: integer().notNull(),
    fromId: text().notNull(),
    fromVariant: text().notNull(),
    path: text().notNull(),
    toId: text().notNull()
  },
  EdgeTable => {
    return {
      byTo: index().on(EdgeTable.toId),
      byFromUid: index().on(EdgeTable.fromUid)
    }
  }
)

// The backing virtual table is created in DocDB setup, this definition is
// only used to build queries against it
const SearchTable = sqliteTable('doc_search', {
  rowid: integer().notNull(),
  title: text(),
  body: text(),
  rank: integer()
})

function jsonPath(path: string): string {
  return `'$.${path.replaceAll("'", "''")}'`
}

function dataField<T>(path: string): HasSql<T> {
  // The path is inlined (not bound) so SQLite can match expression indexes
  return sql<T>`${DocTable.data}->>${sql.unsafe(jsonPath(path))}`
}

function fieldCondition(input: DocFieldCondition): HasSql<boolean> {
  const field = dataField(input.path)
  const conditions: Array<HasSql<boolean>> = []
  if ('eq' in input) conditions.push(eq(field, input.eq))
  if ('ne' in input) conditions.push(ne(field, input.ne))
  if ('gt' in input) conditions.push(gt(field, input.gt))
  if ('gte' in input) conditions.push(gte(field, input.gte))
  if ('lt' in input) conditions.push(lt(field, input.lt))
  if ('lte' in input) conditions.push(lte(field, input.lte))
  if ('in' in input) conditions.push(inArray(field, input.in!))
  if ('like' in input)
    conditions.push(like(field as HasSql<string>, input.like!))
  if ('isNull' in input)
    conditions.push(input.isNull ? isNull(field) : not(isNull(field)))
  assert(conditions.length > 0, `Empty condition for path: ${input.path}`)
  return and(...conditions)
}

function condition(input: DocCondition): HasSql<boolean> {
  if ('and' in input && Array.isArray(input.and))
    return and(...input.and.map(condition))
  if ('or' in input && Array.isArray(input.or))
    return or(...input.or.map(condition))
  return fieldCondition(input as DocFieldCondition)
}

function searchQuery(terms: string): string {
  return terms
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `"${term.replaceAll('"', '""')}"*`)
    .join(' ')
}

interface DocRow {
  uid: number
  id: string
  parent: string | null
  variant: string
  ancestry: string
  level: number
  data: Record<string, unknown>
}

function fromRow(row: DocRow): Doc {
  return {
    id: row.id,
    parent: row.parent,
    variant: row.variant === NO_VARIANT ? null : row.variant,
    level: row.level,
    data: row.data
  }
}

export class DocDB {
  #db: SyncDatabase<'sqlite'>
  #options: DocDBOptions
  #hasSearch: boolean
  #getById
  #getByIdVariant
  #refsTo

  constructor(db: SyncDatabase<'sqlite'>, options: DocDBOptions = {}) {
    this.#db = db
    this.#options = options
    this.#hasSearch = Boolean(options.searchableText)
    this.#setup()
    this.#getById = db
      .select()
      .from(DocTable)
      .where(eq(DocTable.id, sql.placeholder('id')))
      .limit(1)
      .prepare<{id: string}>('doc_get_by_id')
    this.#getByIdVariant = db
      .select()
      .from(DocTable)
      .where(
        eq(DocTable.id, sql.placeholder('id')),
        eq(DocTable.variant, sql.placeholder('variant'))
      )
      .limit(1)
      .prepare<{id: string; variant: string}>('doc_get_by_id_variant')
    this.#refsTo = db
      .select({
        id: EdgeTable.fromId,
        variant: EdgeTable.fromVariant,
        path: EdgeTable.path,
        target: EdgeTable.toId
      })
      .from(EdgeTable)
      .where(eq(EdgeTable.toId, sql.placeholder('id')))
      .prepare<{id: string}>('doc_refs_to')
  }

  #setup(): void {
    const db = this.#db
    // Skip DDL when booting from a prebuilt image
    const exists = syncResult(
      db.all<string>(
        sql`select name from sqlite_master where type = 'table' and name in ('doc', 'doc_search')`
      )
    )
    if (exists.length === 2) return
    db.migrate(DocTable, EdgeTable)
    db.execute(
      sql.unsafe(
        `CREATE VIRTUAL TABLE IF NOT EXISTS "doc_search" USING fts5(title, body, content='', contentless_delete=1, tokenize='unicode61 remove_diacritics 2', prefix='2 3 4')`
      )
    )
    for (const path of this.#options.indexPaths ?? []) {
      const name = `doc_prop_${path.replace(/[^\w]/g, '_')}`
      db.execute(
        sql.unsafe(
          `CREATE INDEX IF NOT EXISTS "${name}" ON "doc"("data"->>${jsonPath(path)})`
        )
      )
    }
  }

  /** Insert documents, replacing existing (id, variant) pairs */
  insert(docs: Array<DocInput>): void {
    if (docs.length === 0) return
    this.#db.transaction(tx => {
      const ancestries = new Map<string, string>()
      const parents = new Map<string, string | null>()
      for (const doc of docs) {
        const parent = doc.parent ?? null
        if (parents.has(doc.id)) {
          assert(
            parents.get(doc.id) === parent,
            `Mismatched parents for ${doc.id}`
          )
        } else {
          parents.set(doc.id, parent)
        }
      }
      const resolveAncestry = (
        id: string,
        seen: Array<string> = []
      ): string => {
        const cached = ancestries.get(id)
        if (cached) return cached
        assert(!seen.includes(id), `Cyclic parent reference: ${seen}`)
        let ancestry: string
        if (parents.has(id)) {
          const parent = parents.get(id)!
          ancestry = parent
            ? `${resolveAncestry(parent, [...seen, id])}${id}/`
            : `/${id}/`
        } else {
          const row = syncResult(
            tx
              .select(DocTable.ancestry)
              .from(DocTable)
              .where(eq(DocTable.id, id))
              .limit(1)
              .get()
          )
          assert(row !== null, `Missing parent document: ${id}`)
          ancestry = row
        }
        ancestries.set(id, ancestry)
        return ancestry
      }
      for (const doc of docs) {
        const variant = doc.variant ?? NO_VARIANT
        const ancestry = doc.parent
          ? `${resolveAncestry(doc.parent)}${doc.id}/`
          : `/${doc.id}/`
        ancestries.set(doc.id, ancestry)
        const level = ancestry.split('/').length - 3
        this.#deleteDoc(tx, doc.id, variant)
        tx.insert(DocTable)
          .values({
            id: doc.id,
            parent: doc.parent ?? null,
            variant,
            ancestry,
            level,
            data: doc.data
          })
          .run()
        const uid = syncResult(
          tx
            .select(DocTable.uid)
            .from(DocTable)
            .where(eq(DocTable.id, doc.id), eq(DocTable.variant, variant))
            .get()
        )
        assert(uid !== null, `Missing inserted document: ${doc.id}`)
        const links = this.#options.extractLinks?.(doc.data)
        if (links) {
          for (const link of links) {
            tx.insert(EdgeTable)
              .values({
                fromUid: uid,
                fromId: doc.id,
                fromVariant: variant,
                path: link.path,
                toId: link.id
              })
              .run()
          }
        }
        if (this.#hasSearch) {
          const search = this.#options.searchableText!(doc.data)
          if (search && (search.title || search.body)) {
            tx.insert(SearchTable)
              .values({
                rowid: uid,
                title: search.title ?? '',
                body: search.body ?? ''
              })
              .run()
          }
        }
      }
    })
  }

  /** Remove documents. Omitting variant removes all variants of the id */
  remove(refs: Array<{id: string; variant?: string | null}>): void {
    if (refs.length === 0) return
    this.#db.transaction(tx => {
      for (const ref of refs) {
        this.#deleteDoc(
          tx,
          ref.id,
          ref.variant === undefined ? undefined : (ref.variant ?? NO_VARIANT)
        )
      }
    })
  }

  #deleteDoc(
    tx: SyncDatabase<'sqlite'>,
    id: string,
    variant: string | undefined
  ): void {
    const uids = syncResult(
      tx
        .select(DocTable.uid)
        .from(DocTable)
        .where(
          eq(DocTable.id, id),
          variant === undefined ? undefined : eq(DocTable.variant, variant)
        )
        .all()
    )
    if (uids.length === 0) return
    tx.delete(EdgeTable).where(inArray(EdgeTable.fromUid, uids)).run()
    tx.delete(SearchTable).where(inArray(SearchTable.rowid, uids)).run()
    tx.delete(DocTable).where(inArray(DocTable.uid, uids)).run()
  }

  get(id: string, variant?: string | null): Doc | undefined {
    const [row] = syncResult(
      variant === undefined
        ? this.#getById.all({id})
        : this.#getByIdVariant.all({id, variant: variant ?? NO_VARIANT})
    )
    return row ? fromRow(row) : undefined
  }

  getMany(ids: Array<string>, variant?: string | null): Array<Doc> {
    if (ids.length === 0) return []
    return syncResult(
      this.#db
        .select()
        .from(DocTable)
        .where(
          inArray(DocTable.id, ids),
          variant === undefined
            ? undefined
            : eq(DocTable.variant, variant ?? NO_VARIANT)
        )
        .all()
    ).map(fromRow)
  }

  query(query: DocQuery): Array<Doc> {
    const conditions = this.#conditionsOf(query)
    const order = (query.orderBy ?? []).map(by => {
      const field = dataField(by.path)
      return by.desc ? desc(field) : asc(field)
    })

    if (query.search !== undefined) {
      const match = searchQuery(query.search)
      if (!match) return []
      let select = this.#db
        .select()
        .from(DocTable)
        .innerJoin(SearchTable, eq(SearchTable.rowid, DocTable.uid))
        .where(
          sql<boolean>`${sql.identifier('doc_search')} MATCH ${match}`,
          ...conditions
        )
        .orderBy(...order, asc(SearchTable.rank))
      if (query.take !== undefined) select = select.limit(query.take)
      if (query.skip) select = select.offset(query.skip)
      return syncResult(select.all()).map(row => fromRow(row.doc))
    }

    let select = this.#db
      .select()
      .from(DocTable)
      .where(...conditions)
      .orderBy(...order, asc(DocTable.uid))
    if (query.take !== undefined) select = select.limit(query.take)
    if (query.skip) select = select.offset(query.skip)
    return syncResult(select.all()).map(fromRow)
  }

  count(query: DocQuery): number {
    const conditions = this.#conditionsOf(query)
    if (query.search !== undefined) {
      const uids = this.#searchUids(query.search)
      if (uids.length === 0) return 0
      conditions.push(inArray(DocTable.uid, uids))
    }
    return syncResult(this.#db.$count(DocTable, and(...conditions)).get()) ?? 0
  }

  /** All links pointing to the given document */
  referencesTo(id: string): Array<DocReference> {
    return syncResult(this.#refsTo.all({id})).map(row => ({
      ...row,
      variant: row.variant === NO_VARIANT ? null : row.variant
    }))
  }

  /** All links inside the given document */
  referencesFrom(id: string, variant?: string | null): Array<DocReference> {
    return syncResult(
      this.#db
        .select({
          id: EdgeTable.fromId,
          variant: EdgeTable.fromVariant,
          path: EdgeTable.path,
          target: EdgeTable.toId
        })
        .from(EdgeTable)
        .where(
          eq(EdgeTable.fromId, id),
          variant === undefined
            ? undefined
            : eq(EdgeTable.fromVariant, variant ?? NO_VARIANT)
        )
        .all()
    ).map(row => ({
      ...row,
      variant: row.variant === NO_VARIANT ? null : row.variant
    }))
  }

  #conditionsOf(query: DocQuery): Array<HasSql<boolean> | undefined> {
    const conditions: Array<HasSql<boolean> | undefined> = []
    if (query.id !== undefined) {
      conditions.push(
        Array.isArray(query.id)
          ? inArray(DocTable.id, query.id)
          : eq(DocTable.id, query.id)
      )
    }
    if (query.variant !== undefined) {
      const variants = Array.isArray(query.variant)
        ? query.variant
        : [query.variant]
      conditions.push(
        inArray(
          DocTable.variant,
          variants.map(variant => variant ?? NO_VARIANT)
        )
      )
    }
    if (query.parent !== undefined) {
      conditions.push(
        query.parent === null
          ? isNull(DocTable.parent)
          : eq(DocTable.parent, query.parent)
      )
    }
    if (query.descendantOf !== undefined) {
      const ancestry = syncResult(
        this.#db
          .select(DocTable.ancestry)
          .from(DocTable)
          .where(eq(DocTable.id, query.descendantOf))
          .limit(1)
          .get()
      )
      assert(ancestry !== null, `Missing document: ${query.descendantOf}`)
      conditions.push(
        gt(DocTable.ancestry, ancestry),
        lt(DocTable.ancestry, ancestry + ANCESTRY_CEILING)
      )
    }
    if (query.level !== undefined) {
      if (typeof query.level === 'number') {
        conditions.push(eq(DocTable.level, query.level))
      } else {
        if (query.level.gt !== undefined)
          conditions.push(gt(DocTable.level, query.level.gt))
        if (query.level.gte !== undefined)
          conditions.push(gte(DocTable.level, query.level.gte))
        if (query.level.lt !== undefined)
          conditions.push(lt(DocTable.level, query.level.lt))
        if (query.level.lte !== undefined)
          conditions.push(lte(DocTable.level, query.level.lte))
      }
    }
    if (query.linksTo !== undefined) {
      conditions.push(
        inArray(
          DocTable.uid,
          this.#db
            .select(EdgeTable.fromUid)
            .from(EdgeTable)
            .where(eq(EdgeTable.toId, query.linksTo))
        )
      )
    }
    if (query.where) conditions.push(condition(query.where))
    return conditions
  }

  #searchUids(terms: string): Array<number> {
    const match = searchQuery(terms)
    if (!match) return []
    return syncResult(
      this.#db
        .select(SearchTable.rowid)
        .from(SearchTable)
        .where(sql<boolean>`${sql.identifier('doc_search')} MATCH ${match}`)
        .orderBy(asc(SearchTable.rank))
        .all()
    )
  }
}

/**
 * Utility to deep scan document data for links. The callback receives every
 * object value and should return the target document id if it is a link.
 */
export function* scanLinks(
  data: Record<string, unknown>,
  isLink: (value: Record<string, unknown>) => string | undefined
): Generator<DocLink> {
  const stack: Array<[path: string, value: unknown]> = [['', data]]
  while (stack.length > 0) {
    const [path, value] = stack.pop()!
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        stack.push([path ? `${path}.${i}` : String(i), value[i]])
      }
      continue
    }
    if (value === null || typeof value !== 'object') continue
    const record = value as Record<string, unknown>
    const target = isLink(record)
    if (target !== undefined) yield {path, id: target}
    for (const [key, child] of Object.entries(record)) {
      stack.push([path ? `${path}.${key}` : key, child])
    }
  }
}
