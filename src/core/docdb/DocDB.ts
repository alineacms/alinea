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
 * The engine separates stable document nodes from variant-specific document
 * versions:
 * - nodes: hierarchy, ordering, and kind/type
 * - versions: JSON data addressed by (id, variant)
 * - edges: links from anywhere inside a version to another document id
 * - search: optional full text search over caller-provided text
 *
 * The engine knows nothing about CMS semantics. A CMS can model workspaces,
 * roots, and entries as nodes, then use structured variants such as
 * `{status: "draft", locale: "en"}` for version dimensions.
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

export interface DocVariantRecord {
  [key: string]: string | null
}

export type DocVariant = string | DocVariantRecord | null

export interface DocLink {
  /** Dotted json path of where the link lives inside the document */
  path: string
  /** The id of the target document */
  id: string
}

export interface DocInput {
  id: string
  parent?: string | null
  kind?: string | null
  index?: string | null
  variant?: DocVariant
  data: Record<string, unknown>
}

export interface Doc {
  id: string
  parent: string | null
  kind: string | null
  index: string | null
  variant: DocVariant
  level: number
  data: Record<string, unknown>
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
  /** Structured variant keys that receive an expression index, eg. `["status", "locale"]` */
  variantIndexPaths?: Array<string>
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
  variant?: DocVariant | Array<DocVariant>
  /** Match one or more structured variant dimensions without requiring an exact variant */
  variantWhere?: DocVariantRecord
  parent?: string | null
  kind?: string | Array<string | null> | null
  /** Select all documents in the subtree of the given id (excluding itself) */
  descendantOf?: string
  level?: number | {gt?: number; gte?: number; lt?: number; lte?: number}
  /** Filter on document data properties */
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
  variant: DocVariant
  /** Dotted json path of the link inside the source document */
  path: string
  /** The link target */
  target: string
}

export type DocOverlayOperation =
  | {op: 'put'; doc: DocInput}
  | {op: 'remove'; id: string; variant?: DocVariant}

export interface DocViewOptions {
  overlay?: Array<DocOverlayOperation>
}

interface RollbackResult<Result> {
  marker: typeof RollbackResultMarker
  result: Result
}

const RollbackResultMarker = Symbol('DocDBRollbackResult')

const NodeTable = sqliteTable(
  'doc_node',
  {
    uid: integer().primaryKey({autoIncrement: true}),
    id: text().notNull(),
    parentId: text(),
    kind: text(),
    index: text(),
    ancestry: text().notNull(),
    level: integer().notNull()
  },
  NodeTable => {
    return {
      id: uniqueIndex().on(NodeTable.id),
      byParent: index().on(NodeTable.parentId),
      byAncestry: index().on(NodeTable.ancestry),
      byKind: index().on(NodeTable.kind)
    }
  }
)

const DocTable = sqliteTable(
  'doc',
  {
    uid: integer().primaryKey({autoIncrement: true}),
    nodeUid: integer().notNull(),
    id: text().notNull(),
    variantKey: text().notNull().default(NO_VARIANT),
    variant: text('variant', {mode: 'json'}).$type<DocVariant>(),
    data: text('data', {mode: 'json'})
      .$type<Record<string, unknown>>()
      .notNull()
  },
  DocTable => {
    return {
      idVariant: uniqueIndex().on(DocTable.id, DocTable.variantKey),
      byNode: index().on(DocTable.nodeUid)
    }
  }
)

const EdgeTable = sqliteTable(
  'edge',
  {
    fromUid: integer().notNull(),
    fromId: text().notNull(),
    fromVariant: text('fromVariant', {mode: 'json'})
      .$type<DocVariant>(),
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
// only used to build queries against it.
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
  // The path is inlined (not bound) so SQLite can match expression indexes.
  return sql<T>`${DocTable.data}->>${sql.unsafe(jsonPath(path))}`
}

function variantField<T>(path: string): HasSql<T> {
  return sql<T>`${DocTable.variant}->>${sql.unsafe(jsonPath(path))}`
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

function sortedRecord(input: DocVariantRecord): DocVariantRecord {
  const result: DocVariantRecord = {}
  for (const key of Object.keys(input).sort()) result[key] = input[key]
  return result
}

function normalizeVariant(input: DocVariant | undefined): DocVariant {
  if (input === undefined || input === null) return null
  if (typeof input === 'string') return input
  return sortedRecord(input)
}

function variantKey(input: DocVariant | undefined): string {
  const variant = normalizeVariant(input)
  if (variant === null) return NO_VARIANT
  if (typeof variant === 'string') return `:${variant}`
  return JSON.stringify(variant)
}

interface DocRow {
  docUid: number
  nodeUid: number
  id: string
  parent: string | null
  kind: string | null
  index: string | null
  variant: DocVariant
  level: number
  data: Record<string, unknown>
}

interface NodeRow {
  uid: number
  id: string
  parentId: string | null
  kind: string | null
  index: string | null
  ancestry: string
  level: number
}

function fromRow(row: DocRow): Doc {
  return {
    id: row.id,
    parent: row.parent,
    kind: row.kind,
    index: row.index,
    variant: row.variant,
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
      .select(this.#rowShape())
      .from(DocTable)
      .innerJoin(NodeTable, eq(NodeTable.uid, DocTable.nodeUid))
      .where(eq(DocTable.id, sql.placeholder('id')))
      .orderBy(asc(DocTable.uid))
      .limit(1)
      .prepare<{id: string}>('doc_get_by_id')
    this.#getByIdVariant = db
      .select(this.#rowShape())
      .from(DocTable)
      .innerJoin(NodeTable, eq(NodeTable.uid, DocTable.nodeUid))
      .where(
        eq(DocTable.id, sql.placeholder('id')),
        eq(DocTable.variantKey, sql.placeholder('variantKey'))
      )
      .limit(1)
      .prepare<{id: string; variantKey: string}>('doc_get_by_id_variant')
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
    const exists = syncResult(
      db.all<string>(
        sql`select name from sqlite_master where type = 'table' and name in ('doc_node', 'doc', 'doc_search')`
      )
    )
    if (exists.length === 3) return
    db.migrate(NodeTable, DocTable, EdgeTable)
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
    for (const path of this.#options.variantIndexPaths ?? []) {
      const name = `doc_variant_${path.replace(/[^\w]/g, '_')}`
      db.execute(
        sql.unsafe(
          `CREATE INDEX IF NOT EXISTS "${name}" ON "doc"("variant"->>${jsonPath(path)})`
        )
      )
    }
  }

  /** Insert documents, replacing existing (id, variant) pairs. */
  insert(docs: Array<DocInput>): void {
    if (docs.length === 0) return
    this.#db.transaction(tx => {
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
      for (const doc of docs) {
        this.#upsertNode(tx, doc)
        this.#upsertVersion(tx, doc)
      }
      this.#rebuildHierarchy(tx)
    })
  }

  /** Remove documents. Omitting variant removes the node and all variants. */
  remove(refs: Array<{id: string; variant?: DocVariant}>): void {
    if (refs.length === 0) return
    this.#db.transaction(tx => {
      for (const ref of refs) {
        if (ref.variant === undefined) this.#deleteNode(tx, ref.id)
        else this.#deleteVersion(tx, ref.id, variantKey(ref.variant))
      }
      this.#rebuildHierarchy(tx)
    })
  }

  /**
   * Run synchronous reads against a temporary overlay and roll all changes back.
   *
   * This is the fast preview path: it uses SQLite savepoints instead of copying
   * the full in-memory database. Do not return a promise from the callback,
   * because the rollback happens before this method returns.
   */
  withOverlay<Result>(
    options: DocViewOptions,
    run: (db: DocDB) => Result
  ): Result {
    let result: Result | undefined
    try {
      this.#db.transaction(tx => {
        this.#applyOverlay(tx, options.overlay ?? [])
        result = run(this)
        if (result instanceof Promise) {
          throw new Error('DocDB.withOverlay callback must be synchronous')
        }
        throw {marker: RollbackResultMarker, result} as RollbackResult<Result>
      })
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        (error as RollbackResult<Result>).marker === RollbackResultMarker
      ) {
        return (error as RollbackResult<Result>).result
      }
      throw error
    }
    assert(result !== undefined, 'Overlay transaction did not produce a result')
    return result
  }

  #applyOverlay(
    tx: SyncDatabase<'sqlite'>,
    operations: Array<DocOverlayOperation>
  ): void {
    if (operations.length === 0) return
    let hierarchyChanged = false
    for (const operation of operations) {
      switch (operation.op) {
        case 'put':
          hierarchyChanged = this.#upsertNode(tx, operation.doc) || hierarchyChanged
          this.#upsertVersion(tx, operation.doc)
          break
        case 'remove':
          if (operation.variant === undefined) {
            this.#deleteNode(tx, operation.id)
            hierarchyChanged = true
          } else {
            this.#deleteVersion(tx, operation.id, variantKey(operation.variant))
          }
          break
      }
    }
    if (hierarchyChanged) this.#rebuildHierarchy(tx)
  }

  #upsertNode(tx: SyncDatabase<'sqlite'>, doc: DocInput): boolean {
    const existing = syncResult(
      tx
        .select()
        .from(NodeTable)
        .where(eq(NodeTable.id, doc.id))
        .get()
    ) as NodeRow | null
    if (doc.parent !== undefined) {
      assert(doc.parent !== doc.id, `Document cannot parent itself: ${doc.id}`)
    }
    if (existing === null) {
      tx.insert(NodeTable)
        .values({
          id: doc.id,
          parentId: doc.parent ?? null,
          kind: doc.kind ?? null,
          index: doc.index ?? null,
          ancestry: `/${doc.id}/`,
          level: 0
        })
        .run()
      return true
    }
    const parentId = doc.parent === undefined ? existing.parentId : doc.parent
    const kind = doc.kind === undefined ? existing.kind : doc.kind
    const index = doc.index === undefined ? existing.index : doc.index
    tx.update(NodeTable)
      .set({
        parentId,
        kind,
        index
      })
      .where(eq(NodeTable.id, doc.id))
      .run()
    return parentId !== existing.parentId
  }

  #upsertVersion(tx: SyncDatabase<'sqlite'>, doc: DocInput): void {
    const nodeUid = syncResult(
      tx
        .select(NodeTable.uid)
        .from(NodeTable)
        .where(eq(NodeTable.id, doc.id))
        .get()
    )
    assert(nodeUid !== null, `Missing node for document: ${doc.id}`)
    const variant = normalizeVariant(doc.variant)
    const key = variantKey(variant)
    this.#deleteVersion(tx, doc.id, key)
    tx.insert(DocTable)
      .values({
        nodeUid,
        id: doc.id,
        variantKey: key,
        variant,
        data: doc.data
      })
      .run()
    const uid = syncResult(
      tx
        .select(DocTable.uid)
        .from(DocTable)
        .where(eq(DocTable.id, doc.id), eq(DocTable.variantKey, key))
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

  #deleteNode(tx: SyncDatabase<'sqlite'>, id: string): void {
    const rows = syncResult(
      tx.select(DocTable.uid).from(DocTable).where(eq(DocTable.id, id)).all()
    ) as Array<number>
    const uids = rows
    if (uids.length > 0) {
      tx.delete(EdgeTable).where(inArray(EdgeTable.fromUid, uids)).run()
      tx.delete(SearchTable).where(inArray(SearchTable.rowid, uids)).run()
      tx.delete(DocTable).where(inArray(DocTable.uid, uids)).run()
    }
    tx.delete(NodeTable).where(eq(NodeTable.id, id)).run()
  }

  #deleteVersion(
    tx: SyncDatabase<'sqlite'>,
    id: string,
    variantKey: string
  ): void {
    const rows = syncResult(
      tx
        .select(DocTable.uid)
        .from(DocTable)
        .where(eq(DocTable.id, id), eq(DocTable.variantKey, variantKey))
        .all()
    ) as Array<number>
    const uids = rows
    if (uids.length === 0) return
    tx.delete(EdgeTable).where(inArray(EdgeTable.fromUid, uids)).run()
    tx.delete(SearchTable).where(inArray(SearchTable.rowid, uids)).run()
    tx.delete(DocTable).where(inArray(DocTable.uid, uids)).run()
  }

  #rebuildHierarchy(tx: SyncDatabase<'sqlite'>): void {
    const rows = syncResult(tx.select().from(NodeTable).all()) as Array<NodeRow>
    const byId = new Map(rows.map(row => [row.id, row]))
    const resolved = new Map<string, {ancestry: string; level: number}>()
    const resolve = (
      row: NodeRow,
      seen: Array<string> = []
    ): {ancestry: string; level: number} => {
      const cached = resolved.get(row.id)
      if (cached) return cached
      assert(!seen.includes(row.id), `Cyclic parent reference: ${seen}`)
      let value: {ancestry: string; level: number}
      if (row.parentId) {
        const parent = byId.get(row.parentId)
        assert(parent, `Missing parent document: ${row.parentId}`)
        const parentValue = resolve(parent, [...seen, row.id])
        value = {
          ancestry: `${parentValue.ancestry}${row.id}/`,
          level: parentValue.level + 1
        }
      } else {
        value = {ancestry: `/${row.id}/`, level: 0}
      }
      resolved.set(row.id, value)
      return value
    }
    for (const row of rows) {
      const next = resolve(row)
      tx.update(NodeTable)
        .set({ancestry: next.ancestry, level: next.level})
        .where(eq(NodeTable.id, row.id))
        .run()
    }
  }

  get(id: string, variant?: DocVariant): Doc | undefined {
    const rows = syncResult(
      variant === undefined
        ? this.#getById.all({id})
        : this.#getByIdVariant.all({id, variantKey: variantKey(variant)})
    )
    return rows[0] ? fromRow(rows[0]) : undefined
  }

  getMany(ids: Array<string>, variant?: DocVariant): Array<Doc> {
    if (ids.length === 0) return []
    return this.#selectRows([
      inArray(DocTable.id, ids),
      variant === undefined
        ? undefined
        : eq(DocTable.variantKey, variantKey(variant))
    ]).map(fromRow)
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
        .select(this.#rowShape())
        .from(DocTable)
        .innerJoin(NodeTable, eq(NodeTable.uid, DocTable.nodeUid))
        .innerJoin(SearchTable, eq(SearchTable.rowid, DocTable.uid))
        .where(
          sql<boolean>`${sql.identifier('doc_search')} MATCH ${match}`,
          ...conditions
        )
        .orderBy(...order, asc(SearchTable.rank))
      if (query.take !== undefined) select = select.limit(query.take)
      if (query.skip) select = select.offset(query.skip)
      return syncResult(select.all()).map(fromRow)
    }

    return this.#selectRows(conditions, order, query.skip, query.take).map(
      fromRow
    )
  }

  count(query: DocQuery): number {
    return this.query({...query, skip: undefined, take: undefined}).length
  }

  /** All links pointing to the given document id. */
  referencesTo(id: string): Array<DocReference> {
    return syncResult(this.#refsTo.all({id}))
  }

  /** All links inside the given document version. */
  referencesFrom(id: string, variant?: DocVariant): Array<DocReference> {
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
            : eq(EdgeTable.fromVariant, normalizeVariant(variant))
        )
        .all()
    )
  }

  #rowShape() {
    return {
      docUid: DocTable.uid,
      nodeUid: NodeTable.uid,
      id: DocTable.id,
      parent: NodeTable.parentId,
      kind: NodeTable.kind,
      index: NodeTable.index,
      variant: DocTable.variant,
      level: NodeTable.level,
      data: DocTable.data
    }
  }

  #selectRows(
    conditions: Array<HasSql<boolean> | undefined>,
    order: Array<HasSql> = [],
    skip?: number,
    take?: number
  ): Array<DocRow> {
    let select = this.#db
      .select(this.#rowShape())
      .from(DocTable)
      .innerJoin(NodeTable, eq(NodeTable.uid, DocTable.nodeUid))
      .where(...conditions)
      .orderBy(...order, asc(NodeTable.ancestry), asc(DocTable.uid))
    if (take !== undefined) select = select.limit(take)
    if (skip) select = select.offset(skip)
    return syncResult(select.all())
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
          DocTable.variantKey,
          variants.map(variant => variantKey(variant))
        )
      )
    }
    if (query.variantWhere !== undefined) {
      for (const [path, value] of Object.entries(query.variantWhere)) {
        conditions.push(eq(variantField(path), value))
      }
    }
    if (query.parent !== undefined) {
      conditions.push(
        query.parent === null
          ? isNull(NodeTable.parentId)
          : eq(NodeTable.parentId, query.parent)
      )
    }
    if (query.kind !== undefined) {
      const kinds = Array.isArray(query.kind) ? query.kind : [query.kind]
      conditions.push(inArray(NodeTable.kind, kinds))
    }
    if (query.descendantOf !== undefined) {
      const row = syncResult(
        this.#db
          .select(NodeTable.ancestry)
          .from(NodeTable)
          .where(eq(NodeTable.id, query.descendantOf))
          .limit(1)
          .get()
      )
      assert(row !== null, `Missing document: ${query.descendantOf}`)
      conditions.push(
        gt(NodeTable.ancestry, row),
        lt(NodeTable.ancestry, row + ANCESTRY_CEILING)
      )
    }
    if (query.level !== undefined) {
      if (typeof query.level === 'number') {
        conditions.push(eq(NodeTable.level, query.level))
      } else {
        if (query.level.gt !== undefined)
          conditions.push(gt(NodeTable.level, query.level.gt))
        if (query.level.gte !== undefined)
          conditions.push(gte(NodeTable.level, query.level.gte))
        if (query.level.lt !== undefined)
          conditions.push(lt(NodeTable.level, query.level.lt))
        if (query.level.lte !== undefined)
          conditions.push(lte(NodeTable.level, query.level.lte))
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
