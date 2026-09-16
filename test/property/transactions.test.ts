import {expect, test} from 'bun:test'
import * as fc from 'fast-check'
import {Entry} from '#/core/Entry.js'
import {
  generateKeyBetween,
  generateNKeysBetween
} from '#/core/util/FractionalIndexing.js'
import type {EntryStore} from '#/database/EntryStore.js'
import {
  Item,
  linkEntries,
  propertyConfig,
  rawEntriesArb,
  resolvePaths,
  toFixtureEntries
} from './arbitraries.js'
import {createPropertyStore} from './store.js'

const numRuns = Number(process.env.PROPERTY_RUNS ?? 20)
const ROOT = '\0'

type ModelStatus = 'published' | 'draft' | 'archived'

interface ModelEntry {
  id: string
  parentId: string | null
  title: string
  score: number
  flag: boolean
  status: ModelStatus
  index: string
}

interface Model {
  entries: Map<string, ModelEntry>
  /** Ordered children per parent, ROOT for top level. Always index-sorted. */
  order: Map<string, Array<string>>
  /** Working-database row order. Key generation reads siblings in this order. */
  rows: Array<string>
}

function parentKey(parentId: string | null): string {
  return parentId ?? ROOT
}

/** Published with no hidden ancestors. */
function modelVisible(model: Model, entry: ModelEntry): boolean {
  return effectiveStatus(model, entry) === 'published'
}

/** Highest hidden ancestor wins, else the stored status. Matches status inheritance. */
function effectiveStatus(model: Model, entry: ModelEntry): ModelStatus {
  const chain: Array<ModelEntry> = []
  let current: ModelEntry | undefined = entry
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parentId ? model.entries.get(current.parentId) : undefined
  }
  for (const ancestor of chain) {
    if (ancestor.status !== 'published') return ancestor.status
  }
  return 'published'
}

function modelFromLinked(
  entries: Array<{
    id: string
    parentId: string | null
    title: string
    score: number
    flag: boolean
    status: ModelStatus
  }>,
  indexById: Map<string, string>
): Model {
  const model: Model = {entries: new Map(), order: new Map(), rows: []}
  for (const entry of entries) {
    model.entries.set(entry.id, {...entry, index: indexById.get(entry.id)!})
    model.rows.push(entry.id)
  }
  // Creation order matches index order, which matches sibling order.
  reindexOrder(model)
  return model
}

/** Recompute sibling order from indexes, like the database does. */
function reindexOrder(model: Model): void {
  const byParent = new Map<string, Array<ModelEntry>>()
  for (const entry of model.entries.values()) {
    const key = parentKey(entry.parentId)
    const siblings = byParent.get(key) ?? []
    siblings.push(entry)
    byParent.set(key, siblings)
  }
  model.order = new Map(
    [...byParent].map(([key, siblings]) => [
      key,
      siblings
        .sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0))
        .map(entry => entry.id)
    ])
  )
}

/** Row-ordered siblings, mirroring the transaction's view. Rows are keyed
 * by entry version, so renames and moves never change row order. */
function rowSiblings(
  model: Model,
  parentId: string | null,
  exclude?: string
): Array<ModelEntry> {
  return model.rows
    .map(id => model.entries.get(id)!)
    .filter(
      entry => entry && entry.parentId === parentId && entry.id !== exclude
    )
}

function liveIds(model: Model): Array<string> {
  return [...model.entries.keys()].sort()
}

function descendants(model: Model, id: string): Set<string> {
  const found = new Set<string>([id])
  const queue = [id]
  while (queue.length > 0) {
    const current = queue.pop()!
    for (const [candidate, entry] of model.entries) {
      if (entry.parentId === current && !found.has(candidate)) {
        found.add(candidate)
        queue.push(candidate)
      }
    }
  }
  return found
}

function detach(model: Model, id: string): void {
  model.rows = model.rows.filter(row => row !== id)
}

/** Canonical dump compared against the model after every step. */
async function expectModel(store: EntryStore, model: Model): Promise<void> {
  const rows = (await store.find({
    status: 'all',
    select: {
      id: Entry.id,
      parentId: Entry.parentId,
      title: Item.title,
      score: Item.score,
      flag: Item.flag,
      status: Entry.status
    }
  })) as Array<{
    id: string
    parentId: string | null
    title: string
    score: number
    flag: boolean
    status: string
  }>
  expect(
    rows
      .map(row => [
        row.id,
        row.parentId,
        row.title,
        row.score,
        row.flag,
        row.status
      ])
      .sort()
  ).toEqual(
    [...model.entries.values()]
      .map(entry => [
        entry.id,
        entry.parentId,
        entry.title,
        entry.score,
        entry.flag,
        effectiveStatus(model, entry)
      ])
      .sort()
  )
  // Sibling order per parent, including hidden entries so divergent
  // positions cannot hide behind visibility.
  for (const [key, expected] of model.order) {
    if (expected.length === 0) continue
    const parentId = key === ROOT ? null : key
    const children = (await store.find({
      status: 'all',
      parentId,
      select: Entry.id
    })) as Array<string>
    expect(children).toEqual(expected)
  }
  // No cycles, every parent resolves.
  for (const entry of model.entries.values()) {
    const seen = new Set<string>([entry.id])
    let current = entry.parentId
    while (current) {
      expect(seen.has(current)).toBe(false)
      seen.add(current)
      current = model.entries.get(current)?.parentId ?? null
    }
  }
}

type OpTemplate =
  | {
      op: 'create'
      title: string
      score: number
      flag: boolean
      parentPick: number
      draft: boolean
    }
  | {op: 'update'; pick: number; title: string; score: number}
  | {
      op: 'move'
      pick: number
      targetPick: number
      position: 'before' | 'after' | 'on'
    }
  | {op: 'remove'; pick: number}
  | {op: 'publish'; pick: number}
  | {op: 'unpublish'; pick: number}
  | {op: 'archive'; pick: number}

const opArb: fc.Arbitrary<OpTemplate> = fc.oneof(
  fc.record({
    op: fc.constant('create'),
    title: fc.constantFrom('epsilon', 'zeta', 'eta'),
    score: fc.integer({min: 0, max: 3}),
    flag: fc.boolean(),
    parentPick: fc.nat({max: 10}),
    draft: fc.boolean()
  }),
  fc.record({
    op: fc.constant('update'),
    pick: fc.nat({max: 10}),
    title: fc.constantFrom('theta', 'iota'),
    score: fc.integer({min: 0, max: 3})
  }),
  fc.record({
    op: fc.constant('move'),
    pick: fc.nat({max: 10}),
    targetPick: fc.nat({max: 10}),
    position: fc.constantFrom('before', 'after', 'on')
  }),
  fc.record({op: fc.constant('remove'), pick: fc.nat({max: 10})}),
  fc.record({op: fc.constant('publish'), pick: fc.nat({max: 10})}),
  fc.record({op: fc.constant('unpublish'), pick: fc.nat({max: 10})}),
  fc.record({op: fc.constant('archive'), pick: fc.nat({max: 10})})
) as fc.Arbitrary<OpTemplate>

function pickId(model: Model, pick: number): string {
  const ids = liveIds(model)
  return ids[pick % Math.max(ids.length, 1)] ?? 'ghost'
}

test('random mutation sequences keep the store converged with its model', async () => {
  await fc.assert(
    fc.asyncProperty(
      rawEntriesArb,
      fc.array(opArb, {minLength: 1, maxLength: 12}),
      async (raw, ops) => {
        const linked = resolvePaths(linkEntries(raw))
        const fixture = toFixtureEntries(linked)
        const model = modelFromLinked(
          linked,
          new Map(fixture.map(row => [row.id, row.index]))
        )
        let created = 0
        const {store, close} = await createPropertyStore(
          propertyConfig,
          fixture
        )
        try {
          await expectModel(store, model)
          const history: Array<unknown> = []
          for (const [stepIndex, op] of ops.entries()) {
            const before = JSON.stringify(
              await store.find({status: 'all', select: Entry.id})
            )
            history.push(op)
            try {
              switch (op.op) {
                case 'create': {
                  const ids = liveIds(model)
                  const parentId =
                    ids.length > 0 ? ids[op.parentPick % ids.length]! : null
                  const id = `n${created++}`
                  await store.mutate([
                    {
                      op: 'create',
                      id,
                      type: 'Item',
                      locale: null,
                      parentId,
                      status: op.draft ? 'draft' : 'published',
                      data: {title: op.title, score: op.score, flag: op.flag}
                    }
                  ])
                  model.entries.set(id, {
                    id,
                    parentId,
                    title: op.title,
                    score: op.score,
                    flag: op.flag,
                    status: op.draft ? 'draft' : 'published',
                    index: generateKeyBetween(
                      rowSiblings(model, parentId).at(-1)?.index ?? null,
                      null
                    )
                  })
                  model.rows.push(id)
                  reindexOrder(model)
                  break
                }
                case 'update': {
                  const id = pickId(model, op.pick)
                  const entry = model.entries.get(id)
                  // Updates address the stored version, even when hidden.
                  if (!entry || entry.status !== 'published') {
                    await expect(
                      store.mutate([
                        {
                          op: 'update',
                          id,
                          locale: null,
                          status: 'published',
                          set: {title: op.title, score: op.score}
                        }
                      ])
                    ).rejects.toThrow()
                    expect(
                      JSON.stringify(
                        await store.find({status: 'all', select: Entry.id})
                      )
                    ).toBe(before)
                    break
                  }
                  await store.mutate([
                    {
                      op: 'update',
                      id,
                      locale: null,
                      status: 'published',
                      set: {title: op.title, score: op.score}
                    }
                  ])
                  entry.title = op.title
                  entry.score = op.score
                  break
                }
                case 'move': {
                  const id = pickId(model, op.pick)
                  const target = pickId(model, op.targetPick)
                  const moving = model.entries.get(id)
                  const targetEntry = model.entries.get(target)
                  const subtree = moving
                    ? descendants(model, id)
                    : new Set<string>()
                  if (
                    !moving ||
                    !targetEntry ||
                    id === target ||
                    subtree.has(target)
                  ) {
                    await expect(
                      store.mutate([
                        {op: 'move', id, target, dropPosition: op.position}
                      ])
                    ).rejects.toThrow()
                    expect(
                      JSON.stringify(
                        await store.find({status: 'all', select: Entry.id})
                      )
                    ).toBe(before)
                    break
                  }
                  await store.mutate([
                    {
                      op: 'move',
                      id,
                      target: targetEntry.id,
                      dropPosition: op.position
                    }
                  ])
                  const newParentId =
                    op.position === 'on' ? targetEntry.id : targetEntry.parentId
                  moving.parentId = newParentId
                  // Mirror the transaction's key generation exactly.
                  const siblings = rowSiblings(model, newParentId, id)
                  let insertion = siblings.length
                  if (op.position !== 'on') {
                    const at = siblings.findIndex(
                      entry => entry.id === targetEntry.id
                    )
                    insertion = op.position === 'before' ? at : at + 1
                  }
                  if (
                    new Set(siblings.map(entry => entry.index)).size !==
                    siblings.length
                  ) {
                    const ordered = [...siblings]
                    ordered.splice(insertion, 0, moving)
                    const generated = generateNKeysBetween(
                      null,
                      null,
                      ordered.length
                    )
                    ordered.forEach((sibling, position) => {
                      sibling.index = generated[position]!
                    })
                    moving.index = generated[insertion]!
                  } else {
                    moving.index = generateKeyBetween(
                      siblings[insertion - 1]?.index ?? null,
                      siblings[insertion]?.index ?? null
                    )
                  }
                  reindexOrder(model)
                  break
                }
                case 'remove': {
                  const id = pickId(model, op.pick)
                  // Removing a missing entry is a no-op success.
                  await store.mutate([{op: 'remove', id}])
                  const entry = model.entries.get(id)
                  if (!entry) break
                  if (entry.status === 'draft') {
                    // The child directory survives: orphans keep their stored
                    // indexes and sort among their adopted siblings by index.
                    for (const child of rowSiblings(model, id))
                      child.parentId = entry.parentId
                    model.entries.delete(id)
                    detach(model, id)
                    reindexOrder(model)
                    break
                  }
                  for (const removed of descendants(model, id)) {
                    detach(model, removed)
                    model.entries.delete(removed)
                  }
                  reindexOrder(model)
                  break
                }
                case 'publish': {
                  const id = pickId(model, op.pick)
                  const entry = model.entries.get(id)
                  if (!entry || entry.status !== 'draft') {
                    await expect(
                      store.mutate([
                        {op: 'publish', id, locale: null, status: 'draft'}
                      ])
                    ).rejects.toThrow()
                    expect(
                      JSON.stringify(
                        await store.find({status: 'all', select: Entry.id})
                      )
                    ).toBe(before)
                    break
                  }
                  await store.mutate([
                    {op: 'publish', id, locale: null, status: 'draft'}
                  ])
                  entry.status = 'published'
                  break
                }
                case 'unpublish': {
                  const id = pickId(model, op.pick)
                  const entry = model.entries.get(id)
                  if (!entry) {
                    await expect(
                      store.mutate([{op: 'unpublish', id, locale: null}])
                    ).rejects.toThrow()
                    expect(
                      JSON.stringify(
                        await store.find({status: 'all', select: Entry.id})
                      )
                    ).toBe(before)
                    break
                  }
                  await store.mutate([{op: 'unpublish', id, locale: null}])
                  entry.status = 'draft'
                  break
                }
                case 'archive': {
                  const id = pickId(model, op.pick)
                  const entry = model.entries.get(id)
                  if (!entry) {
                    await expect(
                      store.mutate([{op: 'archive', id, locale: null}])
                    ).rejects.toThrow()
                    expect(
                      JSON.stringify(
                        await store.find({status: 'all', select: Entry.id})
                      )
                    ).toBe(before)
                    break
                  }
                  await store.mutate([{op: 'archive', id, locale: null}])
                  entry.status = 'archived'
                  break
                }
              }
              await expectModel(store, model)
            } catch (error) {
              const dump = await store
                .find({status: 'all', select: Entry.id})
                .catch(
                  (dumpError: Error) => `dump failed: ${dumpError.message}`
                )
              console.error(
                `property failure at step ${stepIndex} op=${JSON.stringify(op)}\n` +
                  `history=${JSON.stringify(history)}\n` +
                  `fixture=${JSON.stringify(raw)}\n` +
                  `model=${JSON.stringify([...model.entries.values()])}\n` +
                  `modelOrder=${JSON.stringify([...model.order])}\n` +
                  `store=${JSON.stringify(dump)}`
              )
              throw error
            }
          }
        } finally {
          await close()
        }
      }
    ),
    {numRuns}
  )
}, 60000)
