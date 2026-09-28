import {createGeneratedDatabase} from '#/backend/store/GeneratedDatabase.js'
import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {AsyncLocalStorage} from 'node:async_hooks'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {connect} from 'rado/driver/bun-sqlite'
import {RenderStats, summarizeQuery, timed} from './renderStats.js'

test('settles after queries that start later have finished', async () => {
  const stats = new RenderStats()
  const settled = stats.settled(30)
  await Bun.sleep(10)
  await stats.track({kind: 'query', summary: 'a'}, async row => {
    // Waiting for a sync first is not part of the query's time.
    await Bun.sleep(40)
    await timed(row, () => Bun.sleep(40))
  })
  const result = await settled
  expect(result.rows.map(row => row.summary)).toEqual(['a'])
  expect(result.rows[0].durationMs).toBeGreaterThanOrEqual(35)
  expect(result.rows[0].durationMs).toBeLessThan(75)
})

test('settles without queries and stops waiting at the cap', async () => {
  expect(await new RenderStats().settled(10)).toMatchObject({
    rows: [],
    renderMs: 0
  })
  const stats = new RenderStats()
  void stats.track({kind: 'sync', summary: 'sync'}, () => Bun.sleep(1000))
  const start = performance.now()
  const result = await stats.settled(10, 50)
  expect(performance.now() - start).toBeLessThan(500)
  expect(result.rows[0]).toMatchObject({kind: 'sync', durationMs: 0})
})

test('times queries that wait behind each other by their own execution', async () => {
  const stats = new RenderStats()
  // A connection that runs one query at a time, first in first out.
  let queue = Promise.resolve()
  function execute(ms: number) {
    const done = queue.then(() => Bun.sleep(ms))
    queue = done
    return done
  }
  await Promise.all(
    [40, 40, 40].map((ms, index) =>
      stats.track({kind: 'query', summary: `q${index}`}, row =>
        stats.executed(row, () => execute(ms))
      )
    )
  )
  const result = await stats.settled(10)
  for (const row of result.rows) {
    expect(row.durationMs).toBeGreaterThanOrEqual(35)
    expect(row.durationMs).toBeLessThan(75)
  }
  // The render took as long as the queries in a row, not the sum of their
  // waits: 40 + 80 + 120 ms from call to answer.
  expect(result.renderMs).toBeGreaterThanOrEqual(115)
  expect(result.renderMs).toBeLessThan(200)
})

test('summarizes a query by its mode and filters', () => {
  expect(
    summarizeQuery({first: true, url: '/about', select: Entry.id, take: 2})
  ).toBe('first(url=/about, take=2)')
  expect(summarizeQuery({count: true, filter: {}})).toBe('count(filter)')
})

const Page = ConfigBuilder.document('Page', {
  fields: {title: Field.text('Title')}
})
const config: Config = {
  schema: {Page},
  workspaces: {
    main: ConfigBuilder.workspace('Main', {
      source: 'content',
      roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
    })
  }
}

// React's cache() finds its request through an AsyncLocalStorage, so a
// store of our own shows which request each logged statement belongs to.
test('statements count towards the request whose query ran them', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'alinea-stats-')), 'db')
  const sqlite = new Database(file)
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  const database = new EntryDatabase(config, db)
  const seed = new EntryStore(config, database, new MemorySource())
  await seed.mutate(
    ['a', 'b', 'c'].map(id => ({
      op: 'create' as const,
      id,
      type: 'Page',
      locale: null,
      data: {title: `Title ${id}`}
    }))
  )
  await database.compact()
  await database.close()
  sqlite.close()

  const requests = new AsyncLocalStorage<RenderStats>()
  const store = await createGeneratedDatabase(
    config,
    await runtimeDatabase({
      path: file,
      overlay: true,
      logQuery: (_query, durationMs) =>
        requests.getStore()?.statement(durationMs)
    })
  )
  try {
    const queries = [
      () => store.find({type: Page, select: Entry.title}),
      () => store.first({id: 'b', select: Entry.id}),
      () => store.count({search: 'title'})
    ]
    async function render() {
      for (const query of queries) await query()
    }
    // The first search creates its vocabulary table once.
    await render()
    const alone = new RenderStats()
    await requests.run(alone, render)
    expect(alone.statements).toBeGreaterThan(0)

    const renders = Array.from({length: 3}, () => new RenderStats())
    // Queries of concurrent renders interleave through the store's task
    // queue and the connection's transaction lock.
    await Promise.all(
      renders.flatMap(stats =>
        queries.map(query => requests.run(stats, () => query()))
      )
    )
    for (const stats of renders) expect(stats.statements).toBe(alone.statements)
  } finally {
    await store.close()
  }
})
