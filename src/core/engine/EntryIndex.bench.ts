import {Config, Field} from 'alinea'
import {Config as ConfigUtils, createConfig} from '../Config.js'
import {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import {EntryResolver as BaseEntryResolver} from '../db/EntryResolver.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {exportSource} from '../source/SourceExport.js'
import {
  createRxbEntryArtifact,
  encodeRxbEntryArtifact
} from './RxbEntryArtifact.js'
import {RxbEntryDB} from './RxbEntryDB.js'

const Page = Config.document('Page', {
  fields: {
    title: Field.text('Title'),
    body: Field.text('Body', {searchable: true}),
    score: Field.number('Score'),
    featured: Field.check('Featured'),
    meta: Field.object('Meta', {
      fields: {
        inner: Field.text('Inner')
      }
    }),
    tags: Field.list('Tags', {
      schema: {
        tag: Config.type('Tag', {
          fields: {
            itemId: Field.text('Item id')
          }
        })
      }
    })
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
const scoreCutoff = Math.floor(ROWS * 0.75)

const source = await createSource(ROWS)
const base = new BaseEntryIndex(config)
await base.syncWith(source)
const baseResolver = new BaseEntryResolver(config, base)
const artifact = createRxbEntryArtifact(config, base, {
  configHash: 'bench-config',
  contentHash: base.sha
})
const rxbBytes = encodeRxbEntryArtifact(artifact)
const rxbDb = RxbEntryDB.open(config, rxbBytes)
const exportedSource = await exportSource(source)

const baseIndexFresh = await benchAsync('baseline syncWith fresh', async () => {
  const index = new BaseEntryIndex(config)
  await index.syncWith(source)
})

const rxbBuildFresh = await benchAsync('rxb build bytes fresh', async () => {
  const index = new BaseEntryIndex(config)
  await index.syncWith(source)
  encodeRxbEntryArtifact(
    createRxbEntryArtifact(config, index, {
      configHash: 'bench-config',
      contentHash: index.sha
    })
  )
})

const openRxbDb = bench('open rxb db', () => {
  RxbEntryDB.open(config, rxbBytes)
})

const exportRxbBytes = bench('export rxb bytes', () => {
  rxbDb.exportBytes()
})

const baseResolveById = await benchResolver(
  `baseline resolve id x${RUNS}`,
  baseResolver,
  {
    id: targetId,
    select: Entry.id
  }
)
const rxbResolveById = await benchRxb(`rxb resolve id x${RUNS}`, rxbDb, {
  id: targetId,
  select: Entry.id
})

const baseCountByType = await benchResolver(
  `baseline count type x${RUNS}`,
  baseResolver,
  {
    type: Page,
    count: true
  }
)
const rxbCountByType = await benchRxb(`rxb count type x${RUNS}`, rxbDb, {
  type: 'Page',
  count: true
} as any)

const baseScoreFilter = await benchResolver(
  `baseline score filter x${RUNS}`,
  baseResolver,
  {
    type: Page,
    filter: {score: {gte: scoreCutoff}},
    select: Entry.id
  } as any
)
const rxbScoreFilter = await benchRxb(`rxb score filter x${RUNS}`, rxbDb, {
  type: 'Page',
  filter: {score: {gte: scoreCutoff}},
  select: Entry.id
} as any)

const baseNestedFilter = await benchResolver(
  `baseline nested filter x${RUNS}`,
  baseResolver,
  {
    type: Page,
    filter: {
      and: [
        {featured: true},
        {meta: {has: {inner: {is: 'even'}}}},
        {tags: {includes: {itemId: {is: 'tag-0'}}}}
      ]
    },
    select: Entry.id
  } as any
)
const rxbNestedFilter = await benchRxb(`rxb nested filter x${RUNS}`, rxbDb, {
  type: 'Page',
  filter: {
    and: [
      {featured: true},
      {meta: {has: {inner: {is: 'even'}}}},
      {tags: {includes: {itemId: {is: 'tag-0'}}}}
    ]
  },
  select: Entry.id
} as any)

console.table([
  compare('fresh index/export', baseIndexFresh, rxbBuildFresh),
  single('open rxb db', openRxbDb),
  single('export rxb bytes', exportRxbBytes)
])
console.table([
  compare('resolve id', baseResolveById, rxbResolveById),
  compare('count type', baseCountByType, rxbCountByType),
  compare('score filter', baseScoreFilter, rxbScoreFilter),
  compare('nested/list filter', baseNestedFilter, rxbNestedFilter)
])
console.table(sizeReport(rxbBytes, exportedSource))

async function createSource(rows: number) {
  const source = new MemorySource()
  const tree = await source.getTree()
  const changes = await Promise.all(
    Array.from({length: rows}, async (_, i) => {
      const id = `page-${i}`
      const path = `page-${i}`
      const title = `Page ${i}`
      const contents = new TextEncoder().encode(
        JSON.stringify(
          createRecord(
            {
              id,
              type: 'Page',
              index: i.toString().padStart(8, '0'),
              root: 'pages',
              path,
              title,
              seeded: null,
              parentId: null,
              data: {
                title,
                path,
                body: `Body ${i}`,
                score: i,
                featured: i % 2 === 0,
                meta: {inner: i % 2 === 0 ? 'even' : 'odd'},
                tags: [
                  {itemId: `tag-${i % 5}`},
                  {itemId: `group-${Math.floor(i / 100)}`}
                ]
              }
            },
            'published'
          ),
          null,
          2
        )
      )
      return {
        op: 'add' as const,
        path: ConfigUtils.filePath(
          config,
          'main',
          'pages',
          null,
          `${path}.json`
        ),
        sha: await hashBlob(contents),
        contents
      }
    })
  )
  await source.applyChanges({fromSha: tree.sha, changes})
  return source
}

async function benchResolver(
  name: string,
  resolver: BaseEntryResolver,
  query: Parameters<BaseEntryResolver['resolve']>[0]
) {
  return benchAsync(name, async () => {
    for (let i = 0; i < RUNS; i++) await resolver.resolve(query)
  })
}

async function benchRxb(
  name: string,
  db: RxbEntryDB,
  query: Parameters<RxbEntryDB['resolve']>[0]
) {
  return benchAsync(name, async () => {
    for (let i = 0; i < RUNS; i++) await db.resolve(query)
  })
}

function bench(name: string, run: () => void) {
  const samples = Array<number>()
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now()
    run()
    samples.push(performance.now() - start)
  }
  return {name, duration: median(samples)}
}

async function benchAsync(name: string, run: () => Promise<void>) {
  const samples = Array<number>()
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now()
    await run()
    samples.push(performance.now() - start)
  }
  return {name, duration: median(samples)}
}

function compare(
  name: string,
  baseline: {duration: number},
  rxb: {duration: number}
) {
  return {
    task: name,
    baselineMs: baseline.duration.toFixed(2),
    rxbMs: rxb.duration.toFixed(2),
    rxbVsBaseline: `${(baseline.duration / rxb.duration).toFixed(1)}x`
  }
}

function single(name: string, result: {duration: number}) {
  return {
    task: name,
    ms: result.duration.toFixed(2)
  }
}

function sizeReport(rxbBytes: Uint8Array, exportedSource: unknown) {
  const exportBytes = bytesOfJson(exportedSource)
  return [
    size('exportSource json', exportBytes, exportBytes),
    size('rxb bytes', rxbBytes.byteLength, exportBytes)
  ]
}

function size(name: string, bytes: number, baselineBytes: number) {
  return {
    artifact: name,
    bytes,
    kib: (bytes / 1024).toFixed(1),
    vsExport: `${((bytes / baselineBytes) * 100).toFixed(1)}%`,
    bytesPerRow: (bytes / ROWS).toFixed(1)
  }
}

function bytesOfJson(input: unknown) {
  return Buffer.byteLength(JSON.stringify(input))
}

function median(values: Array<number>) {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
