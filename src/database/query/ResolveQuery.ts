import type {Config} from '#/core/Config.js'
import {Field} from '#/core/Field.js'
import type {GraphQuery, InferProjection, Projection} from '#/core/Graph.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {isRecord} from '#/core/util/Objects.js'
import {count, type Database} from 'rado'
import {storedEntryData, type EntryIndexTarget} from '../entry/EntryTable.js'
import {compileEntryQuery, type ProjectionPlan} from './EntryQuery.js'
import type {RelationSource} from './Relation.js'
import {searchQuery, type SearchQuery} from './Search.js'

/** Query dependencies bound to one connection and its current transaction. */
export interface EntryQueryContext {
  config: Config
  database: Database
  entries: EntryIndexTarget
  searchName: string
  search?(input: GraphQuery['search']): Promise<SearchQuery | undefined>
  prepareSearch(): Promise<void>
  includedAtBuild(filePath: string): boolean | Promise<boolean>
}

export async function resolveEntryQuery(
  query: GraphQuery,
  context: EntryQueryContext
): Promise<unknown> {
  const {database: db, config, entries, searchName} = context
  const search = context.search
    ? await context.search(query.search)
    : searchQuery(query.search, entries, searchName)
  const {rows, plan} = compileEntryQuery(config, query, {
    search,
    entry: entries,
    searchName
  })
  if (plan.needsSearch && !context.search) await context.prepareSearch()
  if (plan.count) return db.select(count()).from(rows.as('matches')).get()
  const result = await rows.all(db)
  if (query.get && !result.length) throw new Error('Entry not found')
  return projectRows(query, plan, result, context)
}

/**
 * The locale field values of a row resolve in: its own locale, or for an
 * untranslated entry the locale the query asked for, or else the locale of
 * the entry that selected it.
 */
function rowLocale(
  query: GraphQuery,
  source: RelationSource,
  inherited: string | null
): string | null {
  return source.locale ?? query.locale ?? query.preferredLocale ?? inherited
}

function createLinkResolver(
  query: GraphQuery,
  locale: string | null,
  context: EntryQueryContext
): LinkResolver {
  const loader: LinkResolver = {
    config: context.config,
    locale,
    includedAtBuild(filePath) {
      return context.includedAtBuild(filePath)
    },
    async resolveLinks<P extends Projection>(
      projection: P,
      ids: ReadonlyArray<string>,
      locale: string | null | undefined = loader.locale
    ): Promise<Array<InferProjection<P>>> {
      return (await resolveEntryQuery(
        {
          select: projection,
          id: {in: ids},
          status: query.status ?? 'published',
          preferredLocale: locale ?? undefined
        },
        context
      )) as Array<InferProjection<P>>
    },
    async resolveTargets<P extends Projection & {id: unknown}>(
      projection: P,
      targets: ReadonlyArray<{entryId: string; locale?: string}>
    ): Promise<Array<InferProjection<P> | undefined>> {
      const targetsByLocale = new Map<string | undefined, Set<string>>()
      for (const {entryId, locale} of targets) {
        const ids = targetsByLocale.get(locale) ?? new Set<string>()
        ids.add(entryId)
        targetsByLocale.set(locale, ids)
      }
      const resultsByLocale = new Map<
        string | undefined,
        Map<string, InferProjection<P>>
      >()
      await Promise.all(
        Array.from(targetsByLocale, async ([locale, ids]) => {
          const results = await loader.resolveLinks(
            projection,
            [...ids],
            locale
          )
          resultsByLocale.set(
            locale,
            new Map(results.map(result => [String(result.id), result]))
          )
        })
      )
      return targets.map(({entryId, locale}) =>
        resultsByLocale.get(locale)?.get(entryId)
      )
    }
  }
  return loader
}

async function projectRows(
  query: GraphQuery,
  plan: ProjectionPlan,
  result: Array<unknown>,
  context: EntryQueryContext,
  inheritedLocale: string | null = null
): Promise<unknown> {
  const rows = await Promise.all(
    result.map(row => projectRow(query, plan, row, context, inheritedLocale))
  )
  // A single result (first/get, parent, next, previous) is null when nothing
  // matches, both at the top level and for nested relations.
  if (!plan.single) return rows
  return rows.length ? rows[0] : null
}

async function projectRow(
  query: GraphQuery,
  plan: ProjectionPlan,
  row: unknown,
  context: EntryQueryContext,
  inheritedLocale: string | null
): Promise<unknown> {
  if (!plan.relations.length && !plan.fields.length && !plan.optional.length)
    return row
  const projected = row as {
    value: unknown
    source: RelationSource
    data?: unknown
  }
  let value = projected.value
  const selectedData =
    plan.fields.length || plan.optional.length
      ? storedEntryData(projected.data, projected.source.path)
      : {}
  const locale = rowLocale(query, projected.source, inheritedLocale)
  const loader = createLinkResolver(query, locale, context)
  await Promise.all(
    plan.fields.map(async selected => {
      const present = Object.hasOwn(selectedData, selected.name)
      if (!selected.path.length) {
        if (!present) value = undefined
        // The Graph resolver returns a falsy top-level selection directly.
        if (value) value = await Field.queryValue(selected.field, value, loader)
      } else {
        const ref = projectionRef(value, selected.path)
        if (!ref) throw new Error('Invalid field projection target')
        const processed = await Field.queryValue(
          selected.field,
          present ? ref.parent[ref.key] : undefined,
          loader
        )
        defineProjection(ref, processed)
      }
    })
  )
  for (const selected of plan.optional) {
    if (hasOwnPath(selectedData, selected.dataPath)) continue
    if (!selected.path.length) value = undefined
    else {
      const ref = projectionRef(value, selected.path)
      if (ref) defineProjection(ref, undefined)
    }
  }
  await Promise.all(
    plan.relations.map(async relation => {
      const relationQuery = {
        ...relation.query,
        status: query.status ?? 'published'
      }
      const included = getProjectionValue(value, relation.path)
      const related = relation.plan.count
        ? (included ?? 0)
        : await projectRows(
            relationQuery,
            relation.plan,
            relationRows(included, relation.plan.single),
            context,
            locale
          )
      if (!relation.path.length) value = related
      else {
        const ref = projectionRef(value, relation.path)
        if (!ref) throw new Error('Invalid relation projection target')
        defineProjection(ref, related)
      }
    })
  )
  return value
}

function hasOwnPath(value: unknown, path: Array<string>): boolean {
  let current = value
  for (const key of path) {
    if (!isRecord(current) || !Object.hasOwn(current, key)) return false
    current = current[key]
  }
  return true
}

interface ProjectionRef {
  parent: Record<string, unknown>
  key: string
}

/** Walk to the container of a non-empty projection path. */
function projectionRef(
  value: unknown,
  path: Array<string>
): ProjectionRef | undefined {
  let target = value
  for (const key of path.slice(0, -1)) {
    if (!isRecord(target)) return undefined
    target = target[key]
  }
  if (!isRecord(target)) return undefined
  return {parent: target, key: path.at(-1)!}
}

function defineProjection(ref: ProjectionRef, value: unknown): void {
  Object.defineProperty(ref.parent, ref.key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true
  })
}

function getProjectionValue(value: unknown, path: Array<string>): unknown {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return
    current = current[key]
  }
  return current
}

function relationRows(value: unknown, single: boolean): Array<unknown> {
  if (single) return value == null ? [] : [value]
  return Array.isArray(value) ? value : []
}
