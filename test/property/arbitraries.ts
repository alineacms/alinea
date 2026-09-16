import type {Config} from '#/core/Config.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {generateNKeysBetween} from '#/core/util/FractionalIndexing.js'
import * as fc from 'fast-check'

export const Item = ConfigBuilder.document('Item', {
  contains: ['Item'],
  fields: {
    title: Field.text('Title'),
    score: Field.number('Score'),
    flag: Field.check('Flag'),
    path: Field.path('Path')
  }
})

export const propertyConfig: Config = {
  schema: {Item},
  workspaces: {
    main: ConfigBuilder.workspace('Main', {
      source: 'content',
      roots: {pages: ConfigBuilder.root('Pages', {contains: ['Item']})}
    })
  }
}

export interface RawEntry {
  title: string
  score: number
  flag: boolean
  status: 'draft' | 'published'
  /** Index into an earlier entry, or null for a root entry. */
  parent: number | null
}

export interface LinkedEntry extends RawEntry {
  id: string
  parentId: string | null
  parentPaths: Array<string>
}

/** Small trees with intentional ties. Statuses stay binary: visible or not. */
export const rawEntriesArb: fc.Arbitrary<Array<RawEntry>> = fc.array(
  fc.record({
    title: fc.constantFrom('alpha', 'beta', 'gamma', 'alpha', 'beta'),
    score: fc.integer({min: 0, max: 3}),
    flag: fc.boolean(),
    status: fc.constantFrom(
      'published',
      'published',
      'published',
      'published',
      'draft'
    ),
    parent: fc.option(fc.nat({max: 24}), {nil: null})
  }) as fc.Arbitrary<RawEntry>,
  {minLength: 1, maxLength: 25}
)

/** Link raw entries into a tree. Acyclic by construction. */
export function linkEntries(raw: Array<RawEntry>): Array<LinkedEntry> {
  return raw.map((entry, index) => {
    const id = `e${index}`
    const parentIndex =
      entry.parent === null ? null : (entry.parent as number) % (index + 1)
    const parentId =
      parentIndex === null || parentIndex >= index ? null : `e${parentIndex}`
    return {...entry, id, parentId, parentPaths: [] as Array<string>}
  })
}

export function resolvePaths(entries: Array<LinkedEntry>): Array<LinkedEntry> {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  return entries.map(entry => {
    const parentPaths: Array<string> = []
    let current = entry.parentId ? byId.get(entry.parentId) : undefined
    const seen = new Set<string>([entry.id])
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      parentPaths.unshift(current.id)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return {...entry, parentPaths}
  })
}

/** Effective visibility: published with no hidden ancestors. Drafts hide their subtrees. */
export function isVisible(
  entries: Array<LinkedEntry>,
  entry: LinkedEntry
): boolean {
  const byId = new Map(entries.map(candidate => [candidate.id, candidate]))
  let current: LinkedEntry | undefined = entry
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current.id)) return false
    seen.add(current.id)
    if (current.status !== 'published') return false
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return true
}

/** Fixture rows for createEntrySource. Paths are globally unique ids. */
export function toFixtureEntries(entries: Array<LinkedEntry>) {
  const indexes = generateNKeysBetween(null, null, entries.length)
  return entries.map((entry, index) => ({
    id: entry.id,
    type: 'Item',
    index: indexes[index]!,
    path: entry.id,
    parentPaths: entry.parentPaths,
    status: entry.status,
    data: {title: entry.title, score: entry.score, flag: entry.flag}
  }))
}

export interface QuerySeed {
  flag: boolean | null
  minScore: number | null
  order: 'score-asc' | 'title-desc' | null
}

/** Query parameters over the Item shape. Plain data so runs stay shrinkable. */
export const querySeedArb: fc.Arbitrary<QuerySeed> = fc.record({
  flag: fc.option(fc.boolean(), {nil: null}),
  minScore: fc.option(fc.integer({min: 0, max: 3}), {nil: null}),
  order: fc.option(
    fc.constantFrom('score-asc', 'title-desc') as fc.Arbitrary<
      'score-asc' | 'title-desc'
    >,
    {nil: null}
  )
})

export function baseQuery(seed: QuerySeed): Record<string, unknown> {
  const filter: Record<string, unknown> = {}
  if (seed.flag !== null) filter.flag = seed.flag
  if (seed.minScore !== null) filter.score = {gte: seed.minScore}
  const query: Record<string, unknown> = {type: Item}
  if (Object.keys(filter).length > 0) query.filter = filter
  if (seed.order === 'score-asc') query.orderBy = {asc: Item.score}
  if (seed.order === 'title-desc') query.orderBy = {desc: Item.title}
  return query
}
