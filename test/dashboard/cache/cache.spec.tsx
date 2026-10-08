import {expect, test} from '@playwright/experimental-ct-react'
import type {Page} from 'playwright'
import {CacheHarness} from './CacheHarness.js'

const edits = 4
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
        .map(base => base.group)
        .toSorted()
    )
    .toEqual(groups)
}

function fetched(page: Page, build: string) {
  return page.evaluate(build => cache.build(build).fetched(), build)
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
  await expect
    .poll(async () => (await bases(page)).map(base => base.group))
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
