import {expect, test} from 'bun:test'
import * as fc from 'fast-check'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Query} from '#/index.js'
import {
  Item,
  baseQuery,
  isVisible,
  linkEntries,
  propertyConfig,
  querySeedArb,
  rawEntriesArb,
  resolvePaths,
  toFixtureEntries,
  type LinkedEntry
} from './arbitraries.js'
import {createPropertyStore} from './store.js'

const numRuns = Number(process.env.PROPERTY_RUNS ?? 20)

async function withStore(
  raw: Parameters<typeof linkEntries>[0],
  run: (
    store: Awaited<ReturnType<typeof createPropertyStore>>['store']
  ) => Promise<void>
): Promise<void> {
  const entries = resolvePaths(linkEntries(raw))
  const {store, close} = await createPropertyStore(
    propertyConfig,
    toFixtureEntries(entries)
  )
  try {
    await run(store)
  } finally {
    await close()
  }
}

function sortedIds(ids: Array<string>): Array<string> {
  return [...ids].sort()
}

test('paging composes', async () => {
  await fc.assert(
    fc.asyncProperty(
      rawEntriesArb,
      querySeedArb,
      fc.integer({min: 0, max: 8}),
      fc.integer({min: 1, max: 6}),
      fc.integer({min: 1, max: 6}),
      async (raw, seed, skip, a, b) => {
        await withStore(raw, async store => {
          const base = baseQuery(seed) as GraphQuery
          const full = await store.find({
            ...base,
            skip,
            take: a + b,
            select: Entry.id
          })
          const first = await store.find({
            ...base,
            skip,
            take: a,
            select: Entry.id
          })
          const rest = await store.find({
            ...base,
            skip: skip + a,
            take: b,
            select: Entry.id
          })
          expect([...first, ...rest]).toEqual(full)
        })
      }
    ),
    {numRuns}
  )
})

test('count agrees with find', async () => {
  await fc.assert(
    fc.asyncProperty(rawEntriesArb, querySeedArb, async (raw, seed) => {
      await withStore(raw, async store => {
        const base = baseQuery(seed) as GraphQuery
        expect(await store.count(base)).toBe(
          (await store.find({...base, select: Entry.id})).length
        )
      })
    }),
    {numRuns}
  )
})

test('get and first agree with find', async () => {
  await fc.assert(
    fc.asyncProperty(rawEntriesArb, async raw => {
      const entries = resolvePaths(linkEntries(raw))
      const target = entries[entries.length - 1]
      await withStore(raw, async store => {
        const found = await store.find({
          id: target.id,
          select: {id: Entry.id, title: Item.title}
        })
        if (!isVisible(entries, target)) {
          expect(found).toEqual([])
          await expect(
            store.get({id: target.id, select: Entry.id})
          ).rejects.toThrow()
          return
        }
        expect(found).toHaveLength(1)
        expect(
          await store.get({
            id: target.id,
            select: {id: Entry.id, title: Item.title}
          })
        ).toEqual(found[0])
        expect(
          await store.resolve({id: target.id, first: true, select: Entry.id})
        ).toBe(found[0].id)
      })
    }),
    {numRuns}
  )
})

test('queries are deterministic', async () => {
  await fc.assert(
    fc.asyncProperty(rawEntriesArb, querySeedArb, async (raw, seed) => {
      await withStore(raw, async store => {
        const base = baseQuery(seed) as GraphQuery
        const select = {
          id: Entry.id,
          children: Query.children({depth: 2, select: Entry.id}),
          siblings: Query.siblings({select: Entry.id}),
          parents: Query.parents({select: Entry.id})
        }
        const one = JSON.stringify(await store.find({...base, select}))
        const two = JSON.stringify(await store.find({...base, select}))
        expect(two).toBe(one)
      })
    }),
    {numRuns}
  )
})

test('drafts stay hidden unless requested', async () => {
  await fc.assert(
    fc.asyncProperty(rawEntriesArb, async raw => {
      const entries = resolvePaths(linkEntries(raw))
      await withStore(raw, async store => {
        const visible = (await store.find({
          type: Item,
          select: Entry.id
        })) as Array<string>
        const all = (await store.find({
          type: Item,
          status: 'all',
          select: {id: Entry.id, status: Entry.status}
        })) as Array<{id: string; status: string}>
        const visibleIds = new Set(visible)
        for (const entry of entries) {
          const row = all.find(candidate => candidate.id === entry.id)
          expect(row).toBeDefined()
          expect(visibleIds.has(entry.id)).toBe(isVisible(entries, entry))
        }
        expect(sortedIds(visible)).toEqual(
          sortedIds(
            entries
              .filter(entry => isVisible(entries, entry))
              .map(entry => entry.id)
          )
        )
      })
    }),
    {numRuns}
  )
})

test('ordering is total', async () => {
  await fc.assert(
    fc.asyncProperty(rawEntriesArb, async raw => {
      await withStore(raw, async store => {
        const byScore = (await store.find({
          type: Item,
          orderBy: {asc: Item.score},
          select: Item.score
        })) as Array<number>
        for (let index = 1; index < byScore.length; index++)
          expect(byScore[index]! >= byScore[index - 1]!).toBe(true)
        const byTitle = (await store.find({
          type: Item,
          orderBy: {desc: Item.title},
          select: Item.title
        })) as Array<string>
        for (let index = 1; index < byTitle.length; index++)
          expect(
            byTitle[index]!.localeCompare(byTitle[index - 1]!, undefined, {
              sensitivity: 'base'
            }) <= 0
          ).toBe(true)
      })
    }),
    {numRuns}
  )
})

test('parent and children stay symmetric without cycles', async () => {
  await fc.assert(
    fc.asyncProperty(rawEntriesArb, async raw => {
      const entries = resolvePaths(linkEntries(raw))
      const byId = new Map(entries.map(entry => [entry.id, entry]))
      await withStore(raw, async store => {
        for (const entry of entries) {
          if (!isVisible(entries, entry)) continue
          // Walk up: terminates at a root within N steps.
          const chain: Array<string> = []
          let current: LinkedEntry | undefined = entry
          while (current?.parentId) {
            expect(chain.length).toBeLessThan(entries.length)
            chain.push(current.parentId)
            current = byId.get(current.parentId)
          }
          const parents = (await store.get({
            id: entry.id,
            select: Query.parents({select: Entry.id})
          })) as Array<string>
          expect(parents).toEqual(chain.reverse())
          if (entry.parentId) {
            const siblings = (await store.get({
              id: entry.parentId,
              select: Query.children({select: Entry.id})
            })) as Array<string>
            expect(siblings).toContain(entry.id)
          }
        }
      })
    }),
    {numRuns}
  )
})

test('filter partitions cover the whole set', async () => {
  await fc.assert(
    fc.asyncProperty(rawEntriesArb, querySeedArb, async (raw, seed) => {
      // Partitioning on flag only covers the base set when the base
      // does not constrain flag itself (the spread would overwrite it).
      fc.pre(seed.flag === null)
      await withStore(raw, async store => {
        const base = baseQuery(seed) as GraphQuery
        const withFlag = (await store.find({
          ...base,
          filter: {
            ...((base.filter as Record<string, unknown>) ?? {}),
            flag: true
          },
          select: Entry.id
        })) as Array<string>
        const withoutFlag = (await store.find({
          ...base,
          filter: {
            ...((base.filter as Record<string, unknown>) ?? {}),
            flag: false
          },
          select: Entry.id
        })) as Array<string>
        const whole = (await store.find({
          ...base,
          select: Entry.id
        })) as Array<string>
        expect(sortedIds([...withFlag, ...withoutFlag])).toEqual(
          sortedIds(whole)
        )
        expect(withFlag.filter(id => withoutFlag.includes(id))).toEqual([])
      })
    }),
    {numRuns}
  )
})
