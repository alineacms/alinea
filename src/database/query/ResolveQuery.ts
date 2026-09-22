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
  const plan = compileEntryQuery(config, query, {
    search,
    entry: entries,
    searchName
  })
  if (plan.needsSearch && !context.search) await context.prepareSearch()
  if (plan.count) return db.select(count()).from(plan.rows.as('matches')).get()
  const result = await plan.rows.all(db)
  if (query.get && !result.length) throw new Error('Entry not found')
  return projectRows(query, plan, result, context)
}

function createLinkResolver(
  query: GraphQuery,
  source: RelationSource,
  context: EntryQueryContext
): LinkResolver {
  const loader: LinkResolver = {
    config: context.config,
    locale: source.locale,
    includedAtBuild(filePath) {
      return context.includedAtBuild(filePath)
    },
    async resolveLinks<P extends Projection>(
      projection: P,
      ids: ReadonlyArray<string>,
      locale: string | null | undefined = source.locale
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
  nested = false
): Promise<unknown> {
  const rows = await Promise.all(
    result.map(row => projectRow(query, plan, row, context))
  )
  // Graph's nested projection stage returns undefined for an absent single
  // relation; only the public top-level first/get stage normalizes absence.
  if (!plan.single) return rows
  if (nested || rows.length) return rows[0]
  return null
}

async function projectRow(
  query: GraphQuery,
  plan: ProjectionPlan,
  row: unknown,
  context: EntryQueryContext
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
      : undefined
  const loader = createLinkResolver(query, projected.source, context)
  await Promise.all(
    plan.fields.map(async selected => {
      const present = Object.hasOwn(selectedData!, selected.name)
      if (!selected.path.length) {
        if (!present) value = undefined
        // The Graph resolver returns a falsy top-level selection directly.
        if (value) value = await Field.queryValue(selected.field, value, loader)
      } else {
        let target = value
        for (const key of selected.path.slice(0, -1)) {
          if (!isRecord(target))
            throw new Error('Invalid field projection path')
          target = target[key]
        }
        if (!isRecord(target))
          throw new Error('Invalid field projection target')
        const key = selected.path.at(-1)!
        const processed = await Field.queryValue(
          selected.field,
          present ? target[key] : undefined,
          loader
        )
        Object.defineProperty(target, key, {
          value: processed,
          enumerable: true,
          configurable: true,
          writable: true
        })
      }
    })
  )
  for (const selected of plan.optional) {
    if (hasOwnPath(selectedData!, selected.dataPath)) continue
    if (!selected.path.length) value = undefined
    else setProjectionValue(value, selected.path, undefined)
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
            true
          )
      if (!relation.path.length) value = related
      else {
        let target = value
        for (const key of relation.path.slice(0, -1)) {
          if (!isRecord(target))
            throw new Error('Invalid relation projection path')
          target = target[key]
        }
        if (!isRecord(target))
          throw new Error('Invalid relation projection target')
        Object.defineProperty(target, relation.path.at(-1)!, {
          value: related,
          enumerable: true,
          configurable: true,
          writable: true
        })
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

function setProjectionValue(
  value: unknown,
  path: Array<string>,
  replacement: unknown
): void {
  let target = value
  for (const key of path.slice(0, -1)) {
    if (!isRecord(target)) return
    target = target[key]
  }
  if (isRecord(target)) target[path.at(-1)!] = replacement
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
