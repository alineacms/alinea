/**
 * Measures the explorer page load of a root with 10,000 children of mixed
 * types, a third of them with audit metadata and a tenth only as drafts,
 * and the cost of deriving the columns from the loaded children.
 *
 *   bun test/bench/explorer-overview.ts
 */
import '#test/react.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {syncWith} from '#/core/source/Source.js'
import {getRoot} from '#/core/Internal.js'
import {generateNKeysBetween} from '#/core/util/FractionalIndexing.js'
import {createExplorerAtoms} from '#/dashboard/atoms/explorer.js'
import {
  loadOverviewParent,
  resolveOverview,
  summarizeRows
} from '#/dashboard/atoms/overview.js'
import {userPolicyReadyAtom} from '#/dashboard/atoms/user.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {atom} from 'jotai'
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const size = 10_000
const runs = 10

const Article = Config.document('Article', {
  fields: {intro: Field.text('Intro', {overview: true})}
})
const Event = Config.document('Event', {
  fields: {venue: Field.text('Venue', {overview: true})}
})
const Unused = Config.document('Unused', {
  fields: {code: Field.text('Code', {overview: true})}
})
const config = Config.create({
  schema: {Article, Event, Unused},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})

async function seed() {
  const dir = mkdtempSync(join(tmpdir(), 'alinea-bench-'))
  try {
    mkdirSync(join(dir, 'pages'))
    const keys = generateNKeysBetween(null, null, size)
    for (let i = 0; i < size; i++) {
      const data: Record<string, unknown> = {
        _id: `entry-${i}`,
        _type: i % 2 ? 'Article' : 'Event',
        _index: keys[i],
        title: `Entry ${i}`
      }
      if (i % 3 === 0)
        data.metadata = {
          updatedAt: 1_700_000_000 + i,
          updatedBy: {name: 'Ann', email: 'ann@example.com'}
        }
      const file = `entry-${i}${i % 10 === 0 ? '.draft' : ''}.json`
      writeFileSync(join(dir, 'pages', file), JSON.stringify(data))
    }
    const source = new MemorySource()
    await syncWith(source, new FSSource(dir))
    const db = new LocalDB(config, source)
    await db.sync()
    return db
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

async function time(label: string, run: () => Promise<unknown>) {
  await run()
  const samples: Array<number> = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    await run()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]
  console.log(
    `${label.padEnd(44)} median ${median.toFixed(1).padStart(6)} ms` +
      `  min ${samples[0].toFixed(1).padStart(6)} ms`
  )
}

const db = await seed()
console.log(`${size} children, ${runs} runs each\n`)

async function pageLoad() {
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {rootData: atom(getRoot(config.workspaces.main.pages))}
  )
  const start = performance.now()
  const page = await store.get(explorer.pageReady)
  const elapsed = performance.now() - start
  return {elapsed, page, store, explorer}
}

const loads: Array<number> = []
let loaded = await pageLoad()
for (let i = 0; i < runs; i++) {
  loaded = await pageLoad()
  loads.push(loaded.elapsed)
}
loads.sort((a, b) => a - b)
console.log(
  `${'explorer page load (cold store)'.padEnd(44)} median ${loads[
    Math.floor(runs / 2)
  ]
    .toFixed(1)
    .padStart(6)} ms  min ${loads[0].toFixed(1).padStart(6)} ms`
)
console.log(
  `columns: ${loaded.page.overview.columns.map(column => column.key).join(', ')}`
)

const {store, explorer, page} = loaded
const rows = page.items.map(item => store.get(store.get(item.data).data.item))
const parent = await loadOverviewParent(config, db, {
  workspace: 'main',
  root: 'pages'
})
await time('summarize the loaded children', async () => summarizeRows(rows))
await time('resolve the columns from the summary', async () =>
  resolveOverview(config, parent, {children: summarizeRows(rows)})
)
await time('count children (a scan of the children)', () =>
  db.count({
    workspace: 'main',
    root: 'pages',
    parentId: null,
    locale: null,
    status: 'preferDraft'
  })
)
await time('sort change and back', async () => {
  store.set(explorer.sort, {column: 'title', direction: 'desc'})
  await store.get(explorer.pageReady)
  store.set(explorer.sort, undefined)
  await store.get(explorer.pageReady)
})
await db.close()
