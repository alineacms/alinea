import {Config, Field} from 'alinea'
import {createConfig} from '../Config.js'
import {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import {EntryResolver as BaseEntryResolver} from '../db/EntryResolver.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {
  compactEntrySnapshot,
  expandEntrySnapshot
} from './EntrySnapshotCodec.js'
import {MemoryEntryEngine} from './EntryEngine.js'
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
const SAMPLES = Number(process.env.ALINEA_BENCH_SAMPLES ?? 5)
const targetId = `page-${Math.floor(ROWS / 2)}`

const source = await createSource(ROWS)
const updateBatch = await createUpdateBatch(source, Math.floor(ROWS / 3))
const base = new BaseEntryIndex(config)
const engine = new EntryIndex(config)

await base.syncWith(source)
await engine.syncWith(source)

const baseResolver = new BaseEntryResolver(config, base)
const engineResolver = new EntryResolver(config, engine)
const memoryEngine = new MemoryEntryEngine({snapshot: engine.snapshot})

const baseIndexFresh = await benchAsync('base syncWith fresh', async () => {
  const index = new BaseEntryIndex(config)
  await index.syncWith(source)
})

const engineIndexFresh = await benchAsync('engine syncWith fresh', async () => {
  const index = new EntryIndex(config)
  await index.syncWith(source)
})

const baseIndexChanges = await benchAsync(
  'base indexChanges one row',
  async () => {
    const index = new BaseEntryIndex(config)
    await index.syncWith(source)
    await index.indexChanges(updateBatch)
  }
)

const engineIndexChanges = await benchAsync(
  'engine indexChanges one row',
  async () => {
    const index = new EntryIndex(config)
    await index.syncWith(source)
    await index.indexChanges(updateBatch)
  }
)

const compactSnapshot = bench('compact snapshot', () => {
  compactEntrySnapshot(engine.snapshot)
})

const compact = compactEntrySnapshot(engine.snapshot)
const expandSnapshot = bench('expand compact snapshot', () => {
  expandEntrySnapshot(compact)
})

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

const baseResolveById = await benchAsync(
  `base resolve id x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await baseResolver.resolve({
        id: targetId,
        select: Entry.id
      })
    }
  }
)

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

const memoryQueryById = await benchAsync(
  `memory engine query id x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await memoryEngine.query({
        query: {id: targetId, select: Entry.id}
      })
    }
  }
)

const memoryQueryByIdTrace = await benchAsync(
  `memory engine traced id x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await memoryEngine.query(
        {
          query: {id: targetId, select: Entry.id}
        },
        {trace: true}
      )
    }
  }
)

const memoryCountByType = await benchAsync(
  `memory engine count type x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await memoryEngine.query({
        query: {type: 'Page', count: true}
      })
    }
  }
)

console.log({ROWS, RUNS, SAMPLES})
console.table([
  result('fresh syncWith', baseIndexFresh, engineIndexFresh),
  result('indexChanges one row', baseIndexChanges, engineIndexChanges),
  singleResult('compact snapshot', compactSnapshot),
  singleResult('expand compact snapshot', expandSnapshot)
])
console.table([
  result('id', scanById, planById),
  result('type', scanByType, planByType),
  result('resolve id', baseResolveById, engineResolveById),
  result('memory query id', baseResolveById, memoryQueryById),
  result('memory traced id', baseResolveById, memoryQueryByIdTrace),
  result('memory count type', scanByType, memoryCountByType)
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

async function createUpdateBatch(source: MemorySource, index: number) {
  const tree = await source.getTree()
  const path = `page-${index}`
  const record = createRecord(
    {
      id: path,
      type: 'Page',
      index: index.toString(36).padStart(6, '0'),
      root: 'pages',
      path,
      seeded: null,
      data: {
        title: `Updated page ${index}`,
        body: `Updated searchable page body ${index}`
      }
    },
    'published'
  )
  const contents = new TextEncoder().encode(JSON.stringify(record))
  const sha = await hashBlob(contents)
  return {
    fromSha: tree.sha,
    changes: [
      {
        op: 'add' as const,
        path: `pages/${path}.json`,
        sha,
        contents
      }
    ]
  }
}

function bench(label: string, run: () => void) {
  run()
  const durations = Array.from({length: SAMPLES}, () => {
    const start = performance.now()
    run()
    return performance.now() - start
  })
  return {label, duration: median(durations), durations}
}

async function benchAsync(label: string, run: () => Promise<void>) {
  await run()
  const durations = []
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now()
    await run()
    durations.push(performance.now() - start)
  }
  return {label, duration: median(durations), durations}
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

function singleResult(name: string, result: {duration: number}) {
  return {
    task: name,
    ms: result.duration.toFixed(2)
  }
}

function median(values: Array<number>) {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
