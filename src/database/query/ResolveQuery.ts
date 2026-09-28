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
import {compileEntryQuery, type ProjectionPlan} from './EntryQuery.js'
import type {SearchQuery} from './Search.js'

/** Query dependencies bound to one connection and its current transaction. */
export interface EntryQueryContext {
  config: Config
  database: Database
  search(input: GraphQuery['search']): Promise<SearchQuery | undefined>
  includedAtBuild(filePath: string): boolean | Promise<boolean>
}

export async function resolveEntryQuery(
  query: GraphQuery,
  context: EntryQueryContext
): Promise<unknown> {
  const {database: db, config} = context
  const {rows, plan} = compileEntryQuery(config, query, {
    search: await context.search(query.search)
  })
  if (plan.count) return db.select(count()).from(rows.as('matches')).get()
  const result = await rows.all(db)
  if (query.get && !result.length) throw new Error('Entry not found')
  const status = query.status ?? 'published'
  const links = createLinkBatcher(status, context)
  return projectRows(status, plan, result, context, links)
}

/** Load the rows of linked entries, in query order, for one lookup. */
interface LinkLoader {
  (
    projection: Projection,
    ids: ReadonlyArray<string>,
    locale: string | undefined
  ): Promise<Array<unknown>>
}

interface LinkBatch {
  ids: Set<string>
  rows: Promise<Array<{id: string; value: unknown}>>
}

/**
 * Run after the code that is running now. Rows reach their first lookups
 * without awaiting anything, so one microtask sees the lookups of every row;
 * waiting longer would hold the query's read transaction open for others.
 */
function nextTurn(): Promise<void> {
  return new Promise(resolve => queueMicrotask(resolve))
}

/**
 * Link fields resolve their targets row by row. Lookups with the same
 * projection and locale that are requested while the rows project are
 * answered by one query, so a page of results with a few links each costs a
 * query per projection rather than one per link.
 */
function createLinkBatcher(
  status: Status,
  context: EntryQueryContext
): LinkLoader {
  const pending = new Map<Projection, Map<string | undefined, LinkBatch>>()
  const load: LinkLoader = async (projection, ids, locale) => {
    let byLocale = pending.get(projection)
    if (!byLocale) pending.set(projection, (byLocale = new Map()))
    let batch = byLocale.get(locale)
    if (!batch) {
      const requested = new Set<string>()
      const group = byLocale
      batch = {
        ids: requested,
        rows: nextTurn().then(() => {
          // Lookups requested from here on start the next batch.
          group.delete(locale)
          if (!group.size) pending.delete(projection)
          return loadLinks(projection, [...requested], locale)
        })
      }
      byLocale.set(locale, batch)
    }
    for (const id of ids) batch.ids.add(id)
    const wanted = new Set(ids)
    const rows = await batch.rows
    return rows.filter(row => wanted.has(row.id)).map(row => row.value)
  }
  async function loadLinks(
    projection: Projection,
    ids: Array<string>,
    locale: string | undefined
  ): Promise<Array<{id: string; value: unknown}>> {
    const {rows, plan} = compileEntryQuery(
      context.config,
      {select: projection, id: {in: ids}, status, preferredLocale: locale},
      {withId: true}
    )
    const result = await rows.all(context.database)
    return Promise.all(
      result.map(async row => ({
        id: (row as {id: string}).id,
        value: await projectRow(status, plan, row, context, load)
      }))
    )
  }
  return load
}

function createLinkResolver(
  locale: string | null,
  context: EntryQueryContext,
  links: LinkLoader
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
      return (await links(projection, ids, locale ?? undefined)) as Array<
        InferProjection<P>
      >
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
  links: LinkLoader,
  inheritedLocale: string | null = null
): Promise<unknown> {
  const rows = await Promise.all(
    result.map(row =>
      projectRow(status, plan, row, context, links, inheritedLocale)
    )
  )
  // A single result (first/get, parent, next, previous) is null when nothing
  // matches, both at the top level and for nested relations.
  if (!plan.single) return rows
  return rows.length ? rows[0] : null
}

async function projectRow(
  status: Status,
  plan: ProjectionPlan,
  row: unknown,
  context: EntryQueryContext,
  links: LinkLoader,
  inheritedLocale: string | null = null
): Promise<unknown> {
  if (!plan.wrapped) return row
  const projected = row as {value: unknown; locale: string | null}
  let value = projected.value
  if (!plan.relations.length && !plan.fields.length) return value
  // Field values resolve in the locale of their row, or for an untranslated
  // entry the locale the query asked for, or else the locale of the entry
  // that selected it.
  const locale = projected.locale ?? plan.locale ?? inheritedLocale
  const loader = createLinkResolver(locale, context, links)
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
            links,
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
