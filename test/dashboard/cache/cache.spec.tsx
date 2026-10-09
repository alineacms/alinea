import {expect, test} from '@playwright/experimental-ct-react'
import type {Page} from 'playwright'
import type {Mutation} from '#/core/db/Mutation.js'
import {CacheHarness} from './CacheHarness.js'
import type {CacheBase} from './CacheWorker.js'

const edits = 4
const seeded = 300
const pageErrors = new WeakMap<Page, Array<string>>()

test.beforeEach(async ({mount, page}) => {
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  pageErrors.set(page, errors)
  await mount(<CacheHarness />)
  expect(await page.evaluate(() => cache.databases())).toEqual([])
})

test.afterEach(async ({page}) => {
  expect(await page.evaluate(() => cache.errors())).toEqual([])
  expect(pageErrors.get(page)).toEqual([])
})

function start(page: Page, builds: Record<string, 'a' | 'b' | 'c'>) {
  return page.evaluate(
    builds =>
      Promise.all(
        Object.entries(builds).map(async ([build, config]) => {
          await cache.load(build, config)
          return cache.build(build).sync()
        })
      ),
    builds
  )
}

/** Two builds of different configs open one base and edit it at once. */
async function twoBuilds(page: Page): Promise<string> {
  const [seed] = await start(page, {a: 'a'})
  await stored(page, ['config-a'], seed)
  await start(page, {b: 'b'})
  expect(await fetched(page, 'b')).toBe(0)
  await page.evaluate(
    edits =>
      Promise.all(
        Array.from({length: edits}, (_, i) =>
          ['a', 'b'].map(build =>
            cache.build(build).queue(`${build}${i}`, [
              {
                op: 'update',
                id: `p${build === 'a' ? i : 100 + i}`,
                locale: null,
                status: 'published',
                set: {title: `Edited by ${build}`}
              },
              {
                op: 'create',
                id: `${build}${i}`,
                type: 'Page',
                locale: null,
                data: {title: `Created by ${build}`}
              }
            ])
          )
        ).flat()
      ),
    edits
  )
  for (const build of ['a', 'b'])
    expect(
      await page.evaluate(build => cache.build(build).flushed(), build)
    ).toEqual([])
  const [a, b] = await page.evaluate(() =>
    Promise.all([cache.build('a').sync(), cache.build('b').sync()])
  )
  expect(a).toBe(b)
  return a
}

function answers(page: Page, build: string) {
  return page.evaluate(async build => {
    const db = cache.build(build)
    return {
      created: (await db.count()) - cache.seeded,
      a: await db.title('p0'),
      b: await db.title('p100'),
      body: await db.search('needle'),
      summary: await db.search('haystack')
    }
  }, build)
}

const edited = {created: 2 * edits, a: 'Edited by a', b: 'Edited by b'}

function bases(page: Page) {
  return page.evaluate(() => cache.bases())
}

/** Checkpoints are stored in the background after a sync. */
async function stored(page: Page, groups: Array<string>, tree?: string) {
  await expect
    .poll(async () =>
      (await bases(page))
        .filter(base => tree === undefined || base.tree === tree)
        .map(base => base.branch)
        .toSorted()
    )
    .toEqual(groups)
}

function fetched(page: Page, build: string) {
  return page.evaluate(build => cache.build(build).fetched(), build)
}

function update(id: string, title: string): Mutation {
  return {op: 'update', id, locale: null, status: 'published', set: {title}}
}

function create(id: string, title: string): Mutation {
  return {op: 'create', id, type: 'Page', locale: null, data: {title}}
}

function remove(id: string): Mutation {
  return {op: 'remove', id}
}

function sync(page: Page, builds: Array<string>) {
  return page.evaluate(
    builds => Promise.all(builds.map(build => cache.build(build).sync())),
    builds
  )
}

/** Queue mutations on each build at once, wait until they reach the server. */
async function edit(page: Page, edits: Record<string, Array<Mutation>>) {
  await page.evaluate(
    edits =>
      Promise.all(
        Object.entries(edits).map(([build, mutations]) =>
          cache.build(build).queue(crypto.randomUUID(), mutations)
        )
      ),
    edits
  )
  for (const build of Object.keys(edits))
    expect(
      await page.evaluate(build => cache.build(build).flushed(), build)
    ).toEqual([])
}

function mutate(page: Page, mutations: Array<Mutation>) {
  return page.evaluate(mutations => cache.mutate(mutations), mutations)
}

/** Titles of `ids`, the entry count and the hits of each searchable field. */
function content(page: Page, build: string, ids: Array<string>) {
  return page.evaluate(
    async ([build, ids]) => {
      const db = cache.build(build)
      return {
        count: await db.count(),
        titles: await Promise.all(ids.map(id => db.title(id))),
        body: await db.search('needle'),
        summary: await db.search('haystack')
      }
    },
    [build, ids] as const
  )
}

/** The newest snapshot of each branch. */
async function heads(page: Page) {
  const heads = new Map<string, CacheBase>()
  for (const base of await bases(page))
    if (!heads.has(base.branch)) heads.set(base.branch, base)
  return heads
}

/** Wait until `branches` keep snapshots, each with its head at `tree`. */
async function settled(page: Page, tree: string, branches: number) {
  await expect
    .poll(async () => [...(await heads(page)).values()].map(base => base.tree))
    .toEqual(Array(branches).fill(tree))
  return heads(page)
}

/** Hits of the field the config searches, in each of `pages` entries. */
function searches(config: 'a' | 'b' | 'c', pages: number) {
  return {
    body: config === 'b' ? pages : 0,
    summary: config === 'c' ? pages : 0
  }
}

/** Run `run`, and count the blobs each of `builds` fetched meanwhile. */
async function fetching<T>(
  page: Page,
  builds: Array<string>,
  run: () => Promise<T>
): Promise<[T, Array<number>]> {
  const count = () => Promise.all(builds.map(build => fetched(page, build)))
  const before = await count()
  const result = await run()
  const after = await count()
  return [result, after.map((n, i) => n - before[i])]
}

test('two builds of other configs share the cache', async ({page}) => {
  const tree = await twoBuilds(page)
  expect(await answers(page, 'a')).toEqual({...edited, body: 0, summary: 0})
  expect(await answers(page, 'b')).toEqual({...edited, body: 300, summary: 0})
  await stored(page, ['config-a', 'config-b'], tree)
  for (const base of await bases(page)) {
    expect(base.integrity).toBe('ok')
    expect(base.size).toBeGreaterThan(2 << 20)
  }
})

test('a reload answers from the cache', async ({page}) => {
  const tree = await twoBuilds(page)
  await stored(page, ['config-a', 'config-b'], tree)
  expect(await start(page, {reload: 'a'})).toEqual([tree])
  expect(await fetched(page, 'reload')).toBe(0)
  expect(await answers(page, 'reload')).toEqual({
    ...edited,
    body: 0,
    summary: 0
  })
})

test('a build of a new config derives the cache', async ({page}) => {
  const tree = await twoBuilds(page)
  await stored(page, ['config-a', 'config-b'], tree)
  expect(await start(page, {c: 'c'})).toEqual([tree])
  expect(await fetched(page, 'c')).toBe(0)
  expect(await answers(page, 'c')).toEqual({...edited, body: 0, summary: 300})
  // The branches that keep snapshots, newest first: a branch's head may lie
  // over older snapshots of the same branch, which are kept with it.
  await expect
    .poll(async () => [
      ...new Set((await bases(page)).map(base => base.branch))
    ])
    .toEqual(['config-c', expect.stringMatching(/^config-[ab]$/)])
})

test('a redeploy syncs the same content at once', async ({page}) => {
  const [one, two] = await start(page, {one: 'a', two: 'a'})
  expect(one).toBe(two)
  for (const build of ['one', 'two']) {
    expect(await fetched(page, build)).toBe(300)
    expect(await answers(page, build)).toEqual({
      created: 0,
      a: 'Page 0',
      b: 'Page 100',
      body: 0,
      summary: 0
    })
  }
  await stored(page, ['config-a'])
  expect((await bases(page))[0].integrity).toBe('ok')
  await start(page, {reload: 'a'})
  expect(await fetched(page, 'reload')).toBe(0)
})

test('keeps caches of newer versions only', async ({page}) => {
  const version = await page.evaluate(() => cache.version)
  const name = 'alinea-entry-database'
  const newer = `${name}-v${version + 1}-snapshots`
  const older = [name, `${name}-v1-snapshots`, `${name}-v${version}-pages`]
  for (const database of [newer, ...older])
    await page.evaluate(database => cache.create(database), database)
  await start(page, {a: 'a'})
  const databases = () => page.evaluate(() => cache.databases())
  await expect
    .poll(async () => (await databases()).filter(db => older.includes(db)))
    .toEqual([])
  expect(await databases()).toContain(newer)
})

test('builds of several configs compete on one cache', async ({page}) => {
  const builds = {a1: 'a', a2: 'a', b1: 'b', b2: 'b', c1: 'c'} as const
  const names = Object.keys(builds)
  const rounds = 3
  const initial = await start(page, builds)
  expect(new Set(initial).size).toBe(1)
  for (const build of names)
    expect([0, seeded]).toContain(await fetched(page, build))
  const ids: Array<string> = []
  const titles: Array<string> = []
  let tree = initial[0]
  for (let round = 0; round < rounds; round++) {
    const edits: Record<string, Array<Mutation>> = {}
    for (const [i, build] of names.entries()) {
      const [id, created] = [`p${i * rounds + round}`, `${build}-${round}`]
      edits[build] = [
        update(id, `Edited by ${build}`),
        create(created, `Created by ${build}`)
      ]
      ids.push(id, created)
      titles.push(`Edited by ${build}`, `Created by ${build}`)
    }
    await edit(page, edits)
    const trees = await sync(page, names)
    expect(new Set(trees).size).toBe(1)
    expect(trees[0]).not.toBe(tree)
    tree = trees[0]
  }
  const count = seeded + names.length * rounds
  for (const [build, config] of Object.entries(builds))
    expect(await content(page, build, ids)).toEqual({
      count,
      titles,
      ...searches(config, seeded)
    })
  // Bases of all but the two configs that saved last are deleted.
  await settled(page, tree, 2)
  for (const base of await bases(page)) expect(base.integrity).toBe('ok')
  const reloads = {ra: 'a', rb: 'b', rc: 'c'} as const
  expect(await start(page, reloads)).toEqual([tree, tree, tree])
  for (const [build, config] of Object.entries(reloads)) {
    expect(await fetched(page, build)).toBe(0)
    expect(await content(page, build, ids)).toEqual({
      count,
      titles,
      ...searches(config, seeded)
    })
  }
})

test('syncs fetch only what changed', async ({page}) => {
  const [tree] = await start(page, {a: 'a', b: 'b'})
  let previous = await settled(page, tree, 2)
  const changes = [
    ['p1', 'p2', 'p3', 'p4', 'p5'],
    ['p6', 'p7', 'p8']
  ]
  for (const [round, ids] of changes.entries()) {
    await mutate(page, [
      ...ids.map(id => update(id, `Changed ${round}`)),
      ...(round === 0 ? [remove('p0')] : [])
    ])
    const [trees, blobs] = await fetching(page, ['a', 'b'], () =>
      sync(page, ['a', 'b'])
    )
    expect(blobs).toEqual([ids.length, ids.length])
    expect(trees[0]).toBe(trees[1])
    const next = await settled(page, trees[0], 2)
    for (const [branch, head] of next) {
      expect(head.integrity).toBe('ok')
      // A delta of the changed pages over the snapshot before it.
      expect(head.parent).toBe(previous.get(branch)?.key)
      expect(head.bytes).toBeLessThan(head.size / 4)
    }
    previous = next
  }
  const ids = changes.flat()
  const titles = changes.flatMap((ids, round) =>
    ids.map(() => `Changed ${round}`)
  )
  expect(await start(page, {ra: 'a', rb: 'b'})).toEqual(
    [...previous.values()].map(head => head.tree)
  )
  for (const [build, config] of Object.entries({ra: 'a', rb: 'b'} as const)) {
    expect(await fetched(page, build)).toBe(0)
    expect(await content(page, build, ['p0', ...ids])).toEqual({
      count: seeded - 1,
      titles: [null, ...titles],
      ...searches(config, seeded - 1)
    })
  }
})

test('a new config reuses the cache and syncs what changed', async ({page}) => {
  const [tree] = await start(page, {a: 'a'})
  await stored(page, ['config-a'], tree)
  expect(await start(page, {c: 'c'})).toEqual([tree])
  expect(await fetched(page, 'c')).toBe(0)
  expect(await content(page, 'c', ['p0'])).toEqual({
    count: seeded,
    titles: ['Page 0'],
    ...searches('c', seeded)
  })
  const derived = (await settled(page, tree, 2)).get('config-c')
  const ids = ['p10', 'p20', 'p30']
  await mutate(
    page,
    ids.map(id => update(id, 'Changed'))
  )
  const [trees, blobs] = await fetching(page, ['a', 'c'], () =>
    sync(page, ['a', 'c'])
  )
  expect(blobs).toEqual([ids.length, ids.length])
  expect(trees[0]).toBe(trees[1])
  const head = (await settled(page, trees[0], 2)).get('config-c')
  expect(head?.parent).toBe(derived?.key)
  expect(await start(page, {reload: 'c'})).toEqual([trees[0]])
  expect(await fetched(page, 'reload')).toBe(0)
  expect(await content(page, 'reload', ids)).toEqual({
    count: seeded,
    titles: ids.map(() => 'Changed'),
    ...searches('c', seeded)
  })
})

test('a build loads another config while another edits', async ({page}) => {
  const [tree] = await start(page, {dev: 'a', other: 'a'})
  await stored(page, ['config-a'], tree)
  const rounds = 4
  const ids = Array.from({length: rounds}, (_, i) => `p${i}`)
  const others = (async () => {
    for (const [i, id] of ids.entries()) {
      await edit(page, {
        other: [update(id, 'Edited by other'), create(`other${i}`, 'New')]
      })
      await sync(page, ['other'])
    }
  })()
  const [, reloaded] = await fetching(page, ['dev'], () =>
    page.evaluate(() => cache.load('dev', 'b'))
  )
  expect(reloaded).toEqual([0])
  await edit(page, {dev: [update('p100', 'Edited by dev')]})
  await others
  const [dev, other] = await sync(page, ['dev', 'other'])
  expect(dev).toBe(other)
  const titles = [...ids.map(() => 'Edited by other'), 'Edited by dev']
  for (const [build, config] of Object.entries({dev: 'b', other: 'a'} as const))
    expect(await content(page, build, [...ids, 'p100'])).toEqual({
      count: seeded + rounds,
      titles,
      ...searches(config, seeded)
    })
  await settled(page, dev, 2)
  for (const base of await bases(page)) expect(base.integrity).toBe('ok')
  expect(await start(page, {ra: 'a', rb: 'b'})).toEqual([dev, dev])
  expect(await fetched(page, 'ra')).toBe(0)
  expect(await fetched(page, 'rb')).toBe(0)
})
