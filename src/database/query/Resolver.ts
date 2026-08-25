import type {Config} from '#/core/Config.js'
import {Entry as EntryExpressions, type Entry} from '#/core/Entry.js'
import {EntryFields} from '#/core/EntryFields.js'
import type {Expr} from '#/core/Expr.js'
import {Field} from '#/core/Field.js'
import type {Filter} from '#/core/Filter.js'
import {
  Graph,
  querySource,
  type AnyQueryResult,
  type EdgeQuery,
  type GraphQuery,
  type Projection,
  type QuerySettings,
  type Status
} from '#/core/Graph.js'
import {
  getExpr,
  hasExpr,
  hasField,
  hasRoot,
  hasWorkspace
} from '#/core/Internal.js'
import type {Resolver} from '#/core/Resolver.js'
import type {
  EntryReference,
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {getScope, type Scope} from '#/core/Scope.js'
import {compareStrings} from '#/core/source/Utils.js'
import {assert} from '#/core/util/Assert.js'
import {entries, fromEntries, isRecord} from '#/core/util/Objects.js'
import {unreachable} from '#/core/util/Types.js'
import {Type} from '#/core/Type.js'
import {aliasesFromData, aliasUrl} from '#/core/db/EntryAliases.js'
import {LinkResolver} from '#/core/db/LinkResolver.js'
import MiniSearch from 'minisearch'
import type {DatabaseSnapshot} from '../Database.js'
import {type DatabaseReader, SnapshotDatabaseReader} from '../Reader.js'
import {EntryLoader} from '../entry/Loader.js'
import type {AlineaDatabaseRecord, EntryCoreRecord} from '../entry/Model.js'
import {EntryQueryEngine} from '../entry/Query.js'
import {referencesBySource, referencesByTarget} from '../entry/Indexes.js'
import {filterPredicate} from './Filter.js'

interface ResolveContext {
  status: Status
  locale?: string | null
  searchTerms?: string
  cores: ReadonlyArray<EntryCoreRecord>
  loader: EntryLoader
  previewEntry?: Entry
}

interface QueryResult {
  entries: ReadonlyArray<Entry>
  value: unknown
}

export class DatabaseResolver extends Graph implements Resolver {
  readonly config: Config
  #reader: DatabaseReader<AlineaDatabaseRecord>
  #scope: Scope

  constructor(
    config: Config,
    source:
      | DatabaseReader<AlineaDatabaseRecord>
      | DatabaseSnapshot<AlineaDatabaseRecord>
  ) {
    super()
    this.config = config
    this.#reader =
      'schema' in source ? new SnapshotDatabaseReader(source) : source
    this.#scope = getScope(config)
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const requestedPreview =
      query.preview && 'entry' in query.preview
        ? query.preview.entry
        : undefined
    const previewType = requestedPreview
      ? this.config.schema[requestedPreview.type]
      : undefined
    const preview =
      requestedPreview && previewType
        ? {
            ...requestedPreview,
            title:
              typeof requestedPreview.data.title === 'string'
                ? requestedPreview.data.title
                : requestedPreview.title,
            searchableText: Type.searchableText(
              previewType,
              requestedPreview.data
            )
          }
        : requestedPreview
    const cores = await new EntryQueryEngine(this.#reader).find({status: 'all'})
    const context: ResolveContext = {
      status: query.status ?? 'published',
      locale: query.locale,
      searchTerms: Array.isArray(query.search)
        ? query.search.join(' ')
        : query.search,
      cores,
      loader: new EntryLoader(this.#reader),
      previewEntry: preview
    }
    const result = await this.#query(context, query as GraphQuery<Projection>)
    return result.value as AnyQueryResult<Query>
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    const references: Array<EntryReference> = []
    let scanned = 0
    for await (const item of this.#reader.scan(
      referencesByTarget,
      query.targetId
    )) {
      scanned++
      if (!matchesReference(item.metadata, query)) continue
      references.push(referenceFromMetadata(item.metadata))
    }
    return {
      references,
      total: references.length,
      scan: {scanned, total: scanned, complete: true}
    }
  }

  async referencesFrom(sourceId: string): Promise<Array<EntryReference>> {
    const references: Array<EntryReference> = []
    for await (const item of this.#reader.scan(referencesBySource, sourceId))
      references.push(referenceFromMetadata(item.metadata))
    return references
  }

  async #query(
    context: ResolveContext,
    query: GraphQuery<Projection>,
    source = context.cores
  ): Promise<QueryResult> {
    const edge = query as EdgeQuery<Projection>
    const structural = this.#coreCondition(context, edge)
    let narrowed = source.filter(structural)
    if (query.search)
      narrowed = await this.#searchCores(
        context,
        narrowed,
        context.searchTerms ?? ''
      )
    const loaded = await Promise.all(
      narrowed.map(core => context.loader.load(core))
    )
    let candidates = loaded.filter((entry): entry is Entry => Boolean(entry))
    if (context.previewEntry) {
      candidates = candidates.map(entry =>
        entry.filePath === context.previewEntry?.filePath
          ? context.previewEntry
          : entry
      )
    }
    const predicate = this.#condition(context, edge)
    let found = candidates.filter(predicate)
    if (query.groupBy) {
      assert(!Array.isArray(query.groupBy), 'groupBy must be a single field')
      const groups = new Map<unknown, Entry>()
      for (const entry of found) {
        const value = this.#expr(context, entry, query.groupBy)
        if (!groups.has(value)) groups.set(value, entry)
      }
      found = [...groups.values()]
    }
    if (query.orderBy) {
      const orders = Array.isArray(query.orderBy)
        ? query.orderBy
        : [query.orderBy]
      found.sort((left, right) => {
        for (const order of orders) {
          const expression = order.asc ?? order.desc
          if (!expression) continue
          const a = this.#expr(context, left, expression)
          const b = this.#expr(context, right, expression)
          const compared = compareValues(a, b, order.caseSensitive)
          if (compared !== 0) return order.asc ? compared : -compared
        }
        return 0
      })
    } else if (edge.edge === 'parents') {
      found.sort((left, right) => left.level - right.level)
    }
    const skip = Math.max(0, query.skip ?? 0)
    const take = query.take
    if (skip > 0 || take !== undefined)
      found = found.slice(skip, take === undefined ? undefined : skip + take)
    if (query.count === true) return {entries: found, value: found.length}

    const selected = await Promise.all(
      found.map(entry => this.#select(context, entry, query))
    )
    const single = this.#isSingleResult(edge)
    return {
      entries: found,
      value: single ? selected[0] : selected
    }
  }

  async #searchCores(
    context: ResolveContext,
    cores: ReadonlyArray<EntryCoreRecord>,
    search: string
  ): Promise<Array<EntryCoreRecord>> {
    const documents = await Promise.all(
      cores.map(async core => {
        if (
          context.previewEntry &&
          context.previewEntry.id === core.entryId &&
          context.previewEntry.status === core.versionStatus &&
          context.previewEntry.locale === core.locale
        )
          return {
            value: core,
            id: core.id,
            title: context.previewEntry.title,
            searchableText: context.previewEntry.searchableText
          }
        const record = await context.loader.search(core, 'read')
        return record
          ? {
              value: core,
              id: core.id,
              title: record.title,
              searchableText: record.searchableText
            }
          : undefined
      })
    )
    return rankSearchDocuments(
      documents.filter(
        (
          document
        ): document is {
          value: EntryCoreRecord
          id: string
          title: string
          searchableText: string
        } => Boolean(document)
      ),
      search
    )
  }

  #isSingleResult(query: GraphQuery & Partial<EdgeQuery>): boolean {
    return Boolean(
      query.first ||
      query.get ||
      query.count ||
      query.edge === 'parent' ||
      query.edge === 'next' ||
      query.edge === 'previous'
    )
  }

  #condition(
    context: ResolveContext,
    query: EdgeQuery<Projection>
  ): (entry: Entry) => boolean {
    const location = Array.isArray(query.location)
      ? query.location
      : query.location && this.#scope.locationOf(query.location)
    const locale = query.locale ?? context.locale
    const typeNames = query.type
      ? (Array.isArray(query.type) ? query.type : [query.type]).map(type =>
          this.#scope.nameOf(type as Type)
        )
      : undefined
    const entryFilter = entryPredicate(this.#scope, query)
    const dataFilter = query.filter
      ? filterPredicate(query.filter as Filter, (value, name) => {
          if (!isEntry(value)) return undefined
          if (name.startsWith('_')) return entryFieldValue(value, name.slice(1))
          return value.data[name]
        })
      : undefined
    return entry => {
      if (!matchesStatus(entry, context.status)) return false
      if (location && !matchesLocation(entry, location)) return false
      if (typeNames && !typeNames.includes(entry.type)) return false
      if (query.edge !== 'translations') {
        if (locale !== undefined && !matchesLocale(entry, locale, false))
          return false
        if (
          locale === undefined &&
          query.preferredLocale &&
          !matchesLocale(entry, query.preferredLocale, true)
        )
          return false
      }
      if (!entryFilter(entry)) return false
      if (dataFilter && !dataFilter(entry)) return false
      return true
    }
  }

  #coreCondition(
    context: ResolveContext,
    query: EdgeQuery<Projection>
  ): (entry: EntryCoreRecord) => boolean {
    const location = Array.isArray(query.location)
      ? query.location
      : query.location && this.#scope.locationOf(query.location)
    const locale = query.locale ?? context.locale
    const typeNames = query.type
      ? (Array.isArray(query.type) ? query.type : [query.type]).map(type =>
          this.#scope.nameOf(type as Type)
        )
      : undefined
    const structural = filterPredicate(
      {
        id: query.id,
        parentId: query.parentId,
        path: query.path,
        url: query.url,
        level: query.level,
        workspace:
          isRecord(query.workspace) && hasWorkspace(query.workspace)
            ? this.#scope.nameOf(query.workspace)
            : query.workspace,
        root:
          isRecord(query.root) && hasRoot(query.root)
            ? this.#scope.nameOf(query.root)
            : query.root
      } as Filter,
      (value, name) => {
        if (!isCore(value)) return undefined
        if (name === 'id') return value.entryId
        return value[name as keyof EntryCoreRecord]
      }
    )
    return entry => {
      if (!matchesCoreStatus(entry, context.status)) return false
      if (location && !matchesCoreLocation(entry, location)) return false
      if (typeNames && !typeNames.includes(entry.type)) return false
      if (query.edge !== 'translations') {
        if (locale !== undefined && !matchesCoreLocale(entry, locale, false))
          return false
        if (
          locale === undefined &&
          query.preferredLocale &&
          !matchesCoreLocale(entry, query.preferredLocale, true)
        )
          return false
      }
      return structural(entry)
    }
  }

  async #select(
    context: ResolveContext,
    entry: Entry,
    query: GraphQuery<Projection>
  ): Promise<unknown> {
    const projection = this.#projection(query)
    const links = new LinkResolver(this, context, entry.locale, {
      includedAtBuild: () => true
    })
    return this.#selectProjection(context, entry, projection, links)
  }

  async #selectProjection(
    context: ResolveContext,
    entry: Entry,
    value: Projection,
    links: LinkResolver
  ): Promise<unknown> {
    if (value && hasExpr(value)) {
      const selected = this.#expr(context, entry, value as Expr)
      return hasField(value)
        ? Field.queryValue(value as Field, selected, links)
        : selected
    }
    const edge = querySource(value)
    if (edge) {
      const related = value as EdgeQuery<Projection>
      const source = await this.#edgeSource(context, entry, related)
      const entryLink = edge === 'entryMultiple' || edge === 'entrySingle'
      const relatedQuery = entryLink
        ? {preferredLocale: entry.locale ?? undefined, ...related}
        : related
      const result = await this.#query(
        {
          ...context,
          locale: entryLink ? undefined : entry.locale
        },
        relatedQuery,
        source
      )
      return result.value
    }
    const output: Record<string, unknown> = {}
    for (const [key, projection] of entries(value)) {
      output[key] = await this.#selectProjection(
        context,
        entry,
        projection as Projection,
        links
      )
    }
    return output
  }

  async #edgeSource(
    context: ResolveContext,
    entry: Entry,
    query: EdgeQuery<Projection>
  ): Promise<ReadonlyArray<EntryCoreRecord>> {
    const all = context.cores
    const sameLocale = (core: EntryCoreRecord) => core.locale === entry.locale
    switch (query.edge) {
      case 'parent':
        return entry.parentId
          ? all.filter(
              core => core.entryId === entry.parentId && sameLocale(core)
            )
          : []
      case 'siblings':
        return all.filter(
          core =>
            core.parentId === entry.parentId &&
            core.workspace === entry.workspace &&
            core.root === entry.root &&
            sameLocale(core) &&
            (query.includeSelf || core.entryId !== entry.id)
        )
      case 'translations':
        return all.filter(
          core =>
            core.entryId === entry.id &&
            (query.includeSelf || core.locale !== entry.locale)
        )
      case 'children': {
        const depth = query.depth ?? 1
        return all.filter(
          core =>
            core.parents.includes(entry.id) &&
            core.level > entry.level &&
            core.level <= entry.level + depth
        )
      }
      case 'parents': {
        const ids = new Set(entry.parents.slice(-(query.depth ?? Infinity)))
        return all.filter(core => ids.has(core.entryId) && sameLocale(core))
      }
      case 'next':
      case 'previous': {
        const direction = query.edge === 'next' ? 1 : -1
        const siblings = uniqueNodes(
          all.filter(
            core =>
              core.parentId === entry.parentId &&
              core.workspace === entry.workspace &&
              core.root === entry.root &&
              sameLocale(core)
          )
        )
          .filter(core =>
            direction > 0 ? core.index > entry.index : core.index < entry.index
          )
          .sort(
            (left, right) => direction * compareStrings(left.index, right.index)
          )
        const target = siblings[0]
        return target
          ? all.filter(
              core => core.entryId === target.entryId && sameLocale(core)
            )
          : []
      }
      case 'entryMultiple': {
        const value = this.#field(entry, query.field)
        const ids = new Set(
          Array.isArray(value)
            ? value.flatMap(item =>
                isRecord(item) && typeof item._entry === 'string'
                  ? [item._entry]
                  : []
              )
            : []
        )
        return all.filter(core => ids.has(core.entryId))
      }
      case 'entrySingle': {
        const value = this.#field(entry, query.field)
        const id = isRecord(value) ? value._entry : undefined
        return typeof id === 'string'
          ? all.filter(core => core.entryId === id)
          : []
      }
      default:
        return all
    }
  }

  #projection(query: GraphQuery<Projection>): Projection {
    return (
      query.select ??
      fromEntries(
        (query.type
          ? this.#projectTypes(
              Array.isArray(query.type) ? query.type : [query.type]
            )
          : []
        )
          .concat(entries(EntryFields))
          .concat(query.include ? entries(query.include) : [])
      )
    )
  }

  #projectTypes(types: ReadonlyArray<Type>): Array<[string, Expr]> {
    return entries(EntryFields as Projection).concat(types.flatMap(entries))
  }

  #expr(context: ResolveContext, entry: Entry, expression: Expr): unknown {
    const internal = getExpr(expression)
    switch (internal.type) {
      case 'field':
        return cloneValue(this.#field(entry, expression))
      case 'entryField':
        return entryFieldValue(entry, internal.name, internal.path)
      case 'value':
        return internal.value
      case 'call': {
        if (internal.method !== 'snippet')
          throw new Error(`Unknown method: "${internal.method}"`)
        if (!context.searchTerms)
          throw new Error('Snippet method requires search terms to be provided')
        return snippet(
          entry.searchableText,
          context.searchTerms,
          this.#expr(context, entry, internal.args[0]) as string,
          this.#expr(context, entry, internal.args[1]) as string,
          this.#expr(context, entry, internal.args[2]) as string,
          this.#expr(context, entry, internal.args[3]) as number
        )
      }
      default:
        return unreachable(internal)
    }
  }

  #field(entry: Entry, field: Expr): unknown {
    const name = this.#scope.nameOf(field)
    if (!name) throw new Error(`Expression has no name ${field}`)
    return entry.data[name]
  }
}

function entryPredicate(
  scope: Scope,
  query: QuerySettings
): (entry: Entry) => boolean {
  const root =
    isRecord(query.root) && hasRoot(query.root)
      ? scope.nameOf(query.root)
      : query.root
  const workspace =
    isRecord(query.workspace) && hasWorkspace(query.workspace)
      ? scope.nameOf(query.workspace)
      : query.workspace
  const predicate = filterPredicate(
    {
      id: query.id,
      parentId: query.parentId,
      path: query.path,
      url: query.url,
      createdAt: query.createdAt,
      updatedAt: query.updatedAt,
      level: query.level,
      workspace,
      root
    } as Filter,
    (value, name) => (isEntry(value) ? entryFieldValue(value, name) : undefined)
  )
  if (query.alias === undefined) return entry => predicate(entry)
  return entry =>
    predicate(entry) &&
    (aliasesFromData(entry.data) ?? []).some(
      alias => aliasUrl(alias) === query.alias
    )
}

function entryFieldValue(
  entry: Entry,
  name: string,
  path?: ReadonlyArray<string>
): unknown {
  if (name === 'aliases') return aliasesFromData(entry.data)
  if (path) return valueAtPath(entry.data, [...path, name])
  const expression = EntryExpressions[name as keyof typeof EntryExpressions]
  if (expression) {
    const internal = getExpr(expression)
    if (internal.type === 'entryField' && internal.path)
      return valueAtPath(entry.data, [...internal.path, internal.name])
  }
  return entry[name as keyof Entry]
}

function valueAtPath(value: unknown, path: ReadonlyArray<string>): unknown {
  let current = value
  for (const segment of path) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }
  return current
}

function matchesStatus(entry: Entry, status: Status): boolean {
  switch (status) {
    case 'published':
    case 'draft':
    case 'archived':
      return entry.status === status
    case 'preferDraft':
      return entry.active
    case 'preferPublished':
      return entry.main
    case 'all':
      return true
  }
}

function matchesLocation(
  entry: Entry,
  location: ReadonlyArray<string>
): boolean {
  switch (location.length) {
    case 1:
      return entry.workspace === location[0]
    case 2:
      return entry.workspace === location[0] && entry.root === location[1]
    case 3:
      if (entry.workspace !== location[0] || entry.root !== location[1])
        return false
      if (entry.level === 0) return false
      if (entry.level === 1) return entry.parentDir.endsWith(`/${location[2]}`)
      return entry.parentDir.split('/').at(-entry.level) === location[2]
    default:
      return true
  }
}

function matchesLocale(
  entry: Entry,
  locale: string | null,
  preferred: boolean
): boolean {
  if (preferred && entry.locale === null) return true
  if (typeof entry.locale === 'string' && typeof locale === 'string')
    return entry.locale.toLowerCase() === locale.toLowerCase()
  return entry.locale === locale
}

function isEntry(value: unknown): value is Entry {
  return isRecord(value) && typeof value.id === 'string' && isRecord(value.data)
}

function isCore(value: unknown): value is EntryCoreRecord {
  return isRecord(value) && value.kind === 'entry'
}

function matchesCoreStatus(entry: EntryCoreRecord, status: Status): boolean {
  switch (status) {
    case 'published':
    case 'draft':
    case 'archived':
      return entry.status === status
    case 'preferDraft':
      return entry.active
    case 'preferPublished':
      return entry.main
    case 'all':
      return true
  }
}

function matchesCoreLocation(
  entry: EntryCoreRecord,
  location: ReadonlyArray<string>
): boolean {
  switch (location.length) {
    case 1:
      return entry.workspace === location[0]
    case 2:
      return entry.workspace === location[0] && entry.root === location[1]
    case 3:
      return entry.workspace === location[0] && entry.root === location[1]
    default:
      return true
  }
}

function matchesCoreLocale(
  entry: EntryCoreRecord,
  locale: string | null,
  preferred: boolean
): boolean {
  if (preferred && entry.locale === null) return true
  if (typeof entry.locale === 'string' && typeof locale === 'string')
    return entry.locale.toLowerCase() === locale.toLowerCase()
  return entry.locale === locale
}

function uniqueNodes(
  cores: ReadonlyArray<EntryCoreRecord>
): Array<EntryCoreRecord> {
  const result = new Map<string, EntryCoreRecord>()
  for (const core of cores)
    if (!result.has(core.entryId)) result.set(core.entryId, core)
  return [...result.values()]
}

function cloneValue(value: unknown): unknown {
  return value && typeof value === 'object' ? structuredClone(value) : value
}

function compareValues(
  left: unknown,
  right: unknown,
  caseSensitive = false
): number {
  if (typeof left === 'string' && typeof right === 'string')
    return caseSensitive
      ? compareStrings(left, right)
      : left.localeCompare(right, undefined, {numeric: true})
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return 0
}

const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u
const DIACRITIC = /\p{Diacritic}/gu

function tokenizeSearchText(text: string): Array<string> {
  return text
    .normalize('NFD')
    .replace(DIACRITIC, '')
    .split(SPACE_OR_PUNCTUATION)
}

function normalizedSearchTerms(text: string): Array<string> {
  return tokenizeSearchText(text)
    .filter(Boolean)
    .map(term => term.toLowerCase())
}

interface SearchDocument<Value> {
  value: Value
  id: string
  title: string
  searchableText: string
}

function rankSearchDocuments<Value>(
  source: ReadonlyArray<SearchDocument<Value>>,
  search: string
): Array<Value> {
  const index = new MiniSearch<{
    id: string
    title: string
    searchableText: string
  }>({
    fields: ['title', 'searchableText'],
    tokenize: tokenizeSearchText
  })
  const byId = new Map(source.map(document => [document.id, document]))
  index.addAll(
    source.map(document => ({
      id: document.id,
      title: document.title,
      searchableText: document.searchableText
    }))
  )
  const terms = normalizedSearchTerms(search)
  return index
    .search(search, {
      combineWith: 'AND',
      prefix: true,
      fuzzy: 0.1,
      boost: {title: 10}
    })
    .flatMap(result => {
      const document = byId.get(String(result.id))
      if (!document) return []
      const titleTerms = normalizedSearchTerms(document.title)
      const titlePrefix = terms.every((term, position) =>
        titleTerms[position]?.startsWith(term)
      )
      const titleMatch = Object.values(result.match).some(fields =>
        fields.includes('title')
      )
      return [
        {
          value: document.value,
          priority: terms.length > 0 && titlePrefix ? 2 : titleMatch ? 1 : 0,
          score: result.score
        }
      ]
    })
    .sort(
      (left, right) =>
        right.priority - left.priority || right.score - left.score
    )
    .map(result => result.value)
}

function snippet(
  body: string,
  searchTerms: string,
  start: string,
  end: string,
  cutOff: string,
  limit: number
): string {
  if (limit <= 0 || limit > 64)
    throw new Error(
      "The 'limit' parameter must be greater than zero and less than or equal to 64."
    )
  const terms = searchTerms.toLowerCase().split(/\s+/).filter(Boolean)
  const words = body.split(/\s+/)
  const highlighted = words.map(word =>
    terms.some(term => word.toLowerCase().includes(term))
      ? `${start}${word}${end}`
      : word
  )
  const firstMatch = words.findIndex(word =>
    terms.some(term => word.toLowerCase().includes(term))
  )
  if (firstMatch === -1)
    return words.slice(0, Math.min(limit, words.length)).join(' ')
  const offset = Math.max(0, firstMatch - Math.floor(limit / 2))
  let result = highlighted.slice(offset, offset + limit).join(' ')
  if (offset > 0) result = `${cutOff}${result}`
  if (offset + limit < highlighted.length) result = `${result}${cutOff}`
  return result
}

function matchesReference(
  reference: {
    sourceStatus: Entry['status']
    sourceActive: boolean
    sourceMain: boolean
    sourceLocale: string | null
  },
  query: EntryReferenceQuery
): boolean {
  if (query.locale !== undefined && reference.sourceLocale !== query.locale)
    return false
  switch (query.status ?? 'published') {
    case 'published':
    case 'draft':
    case 'archived':
      return reference.sourceStatus === (query.status ?? 'published')
    case 'preferDraft':
      return reference.sourceActive
    case 'preferPublished':
      return reference.sourceMain
    case 'all':
      return true
  }
}

function referenceFromMetadata(reference: {
  targetId: string
  sourceEntryId: string
  sourceFilePath: string
  sourceType: string
  sourceLocale: string | null
  sourceStatus: Entry['status']
  sourceActive: boolean
  sourceMain: boolean
  fieldPath: string
  fieldLabel?: string
  linkId?: string
  linkType?: 'entry' | 'image' | 'file'
}): EntryReference {
  return {
    targetId: reference.targetId,
    sourceId: reference.sourceEntryId,
    sourceFilePath: reference.sourceFilePath,
    sourceType: reference.sourceType,
    sourceLocale: reference.sourceLocale,
    sourceStatus: reference.sourceStatus,
    sourceActive: reference.sourceActive,
    sourceMain: reference.sourceMain,
    fieldPath: reference.fieldPath,
    fieldLabel: reference.fieldLabel,
    linkId: reference.linkId,
    linkType: reference.linkType
  }
}
