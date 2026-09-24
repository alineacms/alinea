import type {Config} from '#/core/Config.js'
import {Field} from '#/core/Field.js'
import type {
  GraphQuery,
  InferProjection,
  Projection,
  Status
} from '#/core/Graph.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {isRecord} from '#/core/util/Objects.js'
import {count, type Database} from 'rado'
import type {EntryIndexTarget} from '../entry/EntryTable.js'
import {compileEntryQuery, type ProjectionPlan} from './EntryQuery.js'
import type {EntrySearchTarget, SearchQuery} from './Search.js'

/** Query dependencies bound to one connection and its current transaction. */
export interface EntryQueryContext {
  config: Config
  database: Database
  entries: EntryIndexTarget
  searchTable: EntrySearchTarget
  search(input: GraphQuery['search']): Promise<SearchQuery | undefined>
  includedAtBuild(filePath: string): boolean | Promise<boolean>
}

export async function resolveEntryQuery(
  query: GraphQuery,
  context: EntryQueryContext
): Promise<unknown> {
  const {database: db, config, entries, searchTable} = context
  const {rows, plan} = compileEntryQuery(config, query, {
    search: await context.search(query.search),
    entry: entries,
    searchTable
  })
  if (plan.count) return db.select(count()).from(rows.as('matches')).get()
  const result = await rows.all(db)
  if (query.get && !result.length) throw new Error('Entry not found')
  const status = query.status ?? 'published'
  return projectRows(status, plan, result, context)
}

function createLinkResolver(
  status: Status,
  sourceLocale: string | null,
  context: EntryQueryContext
): LinkResolver {
  const loader: LinkResolver = {
    config: context.config,
    locale: sourceLocale,
    includedAtBuild(filePath) {
      return context.includedAtBuild(filePath)
    },
    async resolveLinks<P extends Projection>(
      projection: P,
      ids: ReadonlyArray<string>,
      locale: string | null | undefined = sourceLocale
    ): Promise<Array<InferProjection<P>>> {
      return (await resolveEntryQuery(
        {
          select: projection,
          id: {in: ids},
          status,
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
  status: Status,
  plan: ProjectionPlan,
  result: Array<unknown>,
  context: EntryQueryContext,
  nested = false
): Promise<unknown> {
  const rows = await Promise.all(
    result.map(row => projectRow(status, plan, row, context))
  )
  // Graph's nested projection stage returns undefined for an absent single
  // relation; only the public top-level first/get stage normalizes absence.
  if (!plan.single) return rows
  if (nested || rows.length) return rows[0]
  return null
}

async function projectRow(
  status: Status,
  plan: ProjectionPlan,
  row: unknown,
  context: EntryQueryContext
): Promise<unknown> {
  if (!plan.wrapped) return row
  const projected = row as {value: unknown; locale: string | null}
  let value = projected.value
  if (!plan.relations.length && !plan.fields.length) return value
  const loader = createLinkResolver(status, projected.locale, context)
  await Promise.all(
    plan.fields.map(async selected => {
      if (!selected.path.length) {
        // The Graph resolver returns a falsy top-level selection directly.
        if (value) value = await Field.queryValue(selected.field, value, loader)
      } else {
        const ref = projectionRef(value, selected.path)
        if (!ref) throw new Error('Invalid field projection target')
        const processed = await Field.queryValue(
          selected.field,
          ref.parent[ref.key],
          loader
        )
        defineProjection(ref, processed)
      }
    })
  )
  await Promise.all(
    plan.relations.map(async relation => {
      const included = getProjectionValue(value, relation.path)
      const related = relation.plan.count
        ? (included ?? 0)
        : await projectRows(
            status,
            relation.plan,
            relationRows(included, relation.plan.single),
            context,
            true
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
