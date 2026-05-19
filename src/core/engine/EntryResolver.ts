import type {Config} from '../Config.js'
import {
  type GraphQuery,
  type Projection,
  querySource,
  type Status
} from '../Graph.js'
import type {Entry} from '../Entry.js'
import type {Type} from '../Type.js'
import {Schema} from '../Schema.js'
import {getExpr, hasExpr} from '../Internal.js'
import {getScope, type Scope} from '../Scope.js'
import {
  combineConditions,
  type EntryCondition,
  type EntryNode
} from '../db/EntryIndex.js'
import {
  EntryResolver as BaseEntryResolver,
  type ResolveContext
} from '../db/EntryResolver.js'
import type {EntryQueryConstraints} from './EntryPlanner.js'
import {EntryIndex} from './EntryIndex.js'
import {materializeEntry} from './EntryMaterializer.js'

export class EntryResolver extends BaseEntryResolver {
  index: EntryIndex
  readonly #typeNames: Map<Type, string>
  readonly #scope: Scope
  #lookups: SnapshotLookups | undefined

  constructor(config: Config, index: EntryIndex) {
    super(config, index)
    this.index = index
    this.#typeNames = Schema.typeNames(config.schema)
    this.#scope = getScope(config)
  }

  override query(
    ctx: ResolveContext,
    query: GraphQuery<Projection>,
    preFilter?: EntryCondition
  ) {
    const fast = this.#fastQuery(ctx, query, preFilter)
    if (fast) return fast

    const engineFilter =
      ctx.graph === this.index.graph ? this.#preFilter(query) : undefined
    const combined =
      engineFilter && preFilter
        ? combineConditions(engineFilter, preFilter)
        : (engineFilter ?? preFilter)
    return super.query(ctx, query, combined)
  }

  #fastQuery(
    ctx: ResolveContext,
    query: GraphQuery<Projection>,
    preFilter?: EntryCondition
  ) {
    if (ctx.graph !== this.index.graph) return
    if (preFilter) return
    if (!this.#canFastQuery(query)) return
    const constraints = this.#constraints(query, ctx.status)
    if (!constraints) return
    const plan = this.index.planner.candidates({query, constraints})
    let entries = this.#entriesForRows(plan.rowIds)
    if (query.skip) entries = entries.slice(query.skip)
    if (query.take) entries = entries.slice(0, query.take)
    const isSingle = this.isSingleResult(query)
    const selected = () => entries.map(entry => this.#fastSelect(ctx, entry, query))
    const getUnprocessed = () => {
      if (query.count) return entries.length
      const result = selected()
      return isSingle ? result[0] : result
    }
    const getProcessed = async () => getUnprocessed()
    return {entries, getUnprocessed, getProcessed}
  }

  #canFastQuery(query: GraphQuery<Projection>) {
    if (querySource(query)) return false
    if (query.search) return false
    if (query.filter) return false
    if (query.location) return false
    if (query.preferredLocale) return false
    if (query.orderBy) return false
    if (query.groupBy) return false
    if (query.include) return false
    const status = query.status
    if (
      status &&
      status !== 'published' &&
      status !== 'draft' &&
      status !== 'archived'
    )
      return false
    return this.#canFastProjection(query.select)
  }

  #canFastProjection(projection: Projection | undefined): boolean {
    if (!projection) return false
    if (hasExpr(projection as any)) {
      const expr = getExpr(projection as any)
      return expr.type === 'entryField' || expr.type === 'field'
    }
    if (!isRecord(projection)) return false
    if (querySource(projection)) return false
    return Object.values(projection).every(value =>
      this.#canFastProjection(value as Projection)
    )
  }

  #fastSelect(
    ctx: ResolveContext,
    entry: Entry,
    query: GraphQuery<Projection>
  ): unknown {
    const projection = query.select
    if (!projection) return undefined
    return this.#fastProjection(ctx, entry, projection)
  }

  #fastProjection(
    ctx: ResolveContext,
    entry: Entry,
    projection: Projection
  ): unknown {
    if (hasExpr(projection as any)) {
      const expr = getExpr(projection as any)
      switch (expr.type) {
        case 'entryField':
          return entry[expr.name as keyof Entry]
        case 'field': {
          const name = this.#scope.nameOf(projection as any)
          if (!name) throw new Error(`Expression has no name ${projection}`)
          const value = entry.data[name]
          if (value && typeof value === 'object') return structuredClone(value)
          return value
        }
      }
    }
    return Object.fromEntries(
      Object.entries(projection as Record<string, Projection>).map(
        ([key, value]) => [key, this.#fastProjection(ctx, entry, value)]
      )
    )
  }

  #entriesForRows(rowIds: Array<string>): Array<Entry> {
    const rows = new Set(rowIds)
    const {versions, languages, nodes} = this.#snapshotLookups()
    return Array.from(rows)
      .map(rowId => {
        const version = versions.get(rowId)
        if (!version) return
        const language = languages.get(version.languageId)
        const node = nodes.get(version.nodeId)
        if (!language || !node) return
        return materializeEntry({version, language, node})
      })
      .filter((entry): entry is Entry => Boolean(entry))
  }

  #snapshotLookups(): SnapshotLookups {
    const snapshot = this.index.snapshot
    if (this.#lookups?.snapshot === snapshot) return this.#lookups
    return (this.#lookups = {
      snapshot,
      versions: new Map(snapshot.rows.versions.map(row => [row.rowId, row])),
      languages: new Map(
        snapshot.rows.languages.map(row => [row.languageId, row])
      ),
      nodes: new Map(snapshot.rows.nodes.map(row => [row.nodeId, row]))
    })
  }

  #preFilter(query: GraphQuery<Projection>): EntryCondition | undefined {
    const constraints = this.#constraints(query)
    if (!constraints) return undefined
    const plan = this.index.planner.candidates({
      query,
      constraints
    })
    const nodes = this.#nodesForRows(plan.rowIds)
    return {nodes}
  }

  #constraints(
    query: GraphQuery<Projection>,
    defaultStatus?: Status
  ): EntryQueryConstraints | undefined {
    const constraints: EntryQueryConstraints = {}

    const ids = stringValues(query.id)
    if (ids) constraints.id = ids

    const parentIds = nullableStringValues(query.parentId)
    if (parentIds) constraints.parentId = parentIds

    if (typeof query.workspace === 'string') constraints.workspace = query.workspace
    if (typeof query.root === 'string') constraints.root = query.root
    if (query.locale !== undefined) constraints.locale = query.locale

    const type = typeValues(query.type, this.#typeNames)
    if (type) constraints.type = type

    const status = exactStatus(query.status ?? defaultStatus)
    if (status) constraints.status = status

    return Object.keys(constraints).length > 0 ? constraints : undefined
  }

  #nodesForRows(rowIds: Array<string>): Array<EntryNode> {
    const rows = new Set(rowIds)
    const nodes = new Map<string, EntryNode>()
    for (const version of this.index.snapshot.rows.versions) {
      if (!rows.has(version.rowId)) continue
      const node = this.index.byId(version.nodeId)
      if (node) nodes.set(node.id, node)
    }
    return Array.from(nodes.values())
  }
}

function stringValues(input: unknown): string | Array<string> | undefined {
  if (typeof input === 'string') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(value => typeof value === 'string')
    if (values.length > 0) return values
  }
}

function nullableStringValues(
  input: unknown
): string | null | Array<string | null> | undefined {
  if (input === null || typeof input === 'string') return input
  if (isRecord(input) && Array.isArray(input.in)) {
    const values = input.in.filter(
      value => value === null || typeof value === 'string'
    )
    if (values.length > 0) return values
  }
}

function typeValues(
  input: unknown,
  typeNames: Map<Type, string>
): string | Array<string> | undefined {
  if (!input) return undefined
  const values = Array.isArray(input) ? input : [input]
  const names = values
    .map(value =>
      typeof value === 'string' ? value : typeNames.get(value as Type)
    )
    .filter((value): value is string => typeof value === 'string')
  if (names.length === 0) return undefined
  return Array.isArray(input) ? names : names[0]
}

function exactStatus(status: Status | undefined) {
  switch (status) {
    case 'published':
    case 'draft':
    case 'archived':
      return status
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object')
}

interface SnapshotLookups {
  snapshot: EntryIndex['snapshot']
  versions: Map<string, import('./EntryRows.js').EntryVersionRow>
  languages: Map<string, import('./EntryRows.js').EntryLanguageRow>
  nodes: Map<string, import('./EntryRows.js').EntryNodeRow>
}
