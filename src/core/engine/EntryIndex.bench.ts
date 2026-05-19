import {Config, Field} from 'alinea'
import {createConfig} from '../Config.js'
import {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import {EntryResolver as BaseEntryResolver} from '../db/EntryResolver.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryResolver} from './EntryResolver.js'

const Page = Config.document('Page', {
  fields: {
    title: Field.text('Title'),
    body: Field.text('Body', {searchable: true})
  }
})

const config = createConfig({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {contains: ['Page']})
      }
    })
  }
})

const ROWS = Number(process.env.ALINEA_BENCH_ROWS ?? 10000)
const RUNS = Number(process.env.ALINEA_BENCH_RUNS ?? 1000)
const targetId = `page-${Math.floor(ROWS / 2)}`

const source = await createSource(ROWS)
const base = new BaseEntryIndex(config)
const engine = new EntryIndex(config)

await base.syncWith(source)
await engine.syncWith(source)

const baseResolver = new BaseEntryResolver(config, base)
const engineResolver = new EntryResolver(config, engine)

const scanById = bench(`base findMany id x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    Array.from(base.findMany(entry => entry.id === targetId))
  }
})

const planById = bench(`engine planner id x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    engine.planner.candidates({
      query: {},
      constraints: {id: targetId}
    })
  }
})

const scanByType = bench(`base findMany type x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    Array.from(base.findMany(entry => entry.type === 'Page'))
  }
})

const planByType = bench(`engine planner type x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    engine.planner.candidates({
      query: {},
      constraints: {type: 'Page'}
    })
  }
})

const baseResolveById = await benchAsync(`base resolve id x${RUNS}`, async () => {
  for (let i = 0; i < RUNS; i++) {
    await baseResolver.resolve({
      id: targetId,
      select: Entry.id
    })
  }
})

const engineResolveById = await benchAsync(
  `engine resolve id x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await engineResolver.resolve({
        id: targetId,
        select: Entry.id
      })
    }
  }
)

console.table([
  result('id', scanById, planById),
  result('type', scanByType, planByType),
  result('resolve id', baseResolveById, engineResolveById)
])

async function createSource(rows: number) {
  const source = new MemorySource()
  const tree = await source.getTree()
  const changes = await Promise.all(
    Array.from({length: rows}, async (_, i) => {
      const path = `page-${i}`
      const record = createRecord(
        {
          id: path,
          type: 'Page',
          index: i.toString(36).padStart(6, '0'),
          root: 'pages',
          path,
          seeded: null,
          data: {
            title: `Page ${i}`,
            body: `Searchable page body ${i}`
          }
        },
        'published'
      )
      const contents = new TextEncoder().encode(JSON.stringify(record))
      const sha = await hashBlob(contents)
      return {
        op: 'add' as const,
        path: `pages/${path}.json`,
        sha,
        contents
      }
    })
  )
  await source.applyChanges({fromSha: tree.sha, changes})
  return source
}

function bench(label: string, run: () => void) {
  run()
  const start = performance.now()
  run()
  const duration = performance.now() - start
  return {label, duration}
}

async function benchAsync(label: string, run: () => Promise<void>) {
  await run()
  const start = performance.now()
  await run()
  const duration = performance.now() - start
  return {label, duration}
}

function result(
  name: string,
  base: {duration: number},
  engine: {duration: number}
) {
  return {
    query: name,
    baseMs: base.duration.toFixed(2),
    engineMs: engine.duration.toFixed(2),
    speedup: `${(base.duration / engine.duration).toFixed(1)}x`
  }
}
