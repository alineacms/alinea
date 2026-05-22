import {Config, Edit, Field} from 'alinea'
import {Config as ConfigUtils, createConfig} from '../Config.js'
import {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import {EntryResolver as BaseEntryResolver} from '../db/EntryResolver.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {
  compressRxbEntryBytes,
  createRxbEntryArtifact,
  encodeRxbEntryArtifact
} from './RxbEntryArtifact.js'
import {ContentEntryDB} from './ContentEntryDB.js'
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
    }),
    related: Field.entry.multiple('Related')
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
const RUNS = Number(process.env.ALINEA_BENCH_RUNS ?? 10)
const SAMPLES = Number(process.env.ALINEA_BENCH_SAMPLES ?? 3)
const TRACE = process.env.ALINEA_BENCH_TRACE !== '0'
const targetId = `page-${Math.floor(ROWS / 2)}`
const changedId = Math.floor(ROWS / 2)
const scoreCutoff = Math.floor(ROWS * 0.75)

const source = await createSource(ROWS)
const changedSource = await createSource(ROWS, i =>
  i === changedId
    ? {
        title: `Page ${i} changed`,
        body: `Changed body ${i}`,
        score: i + 1
      }
    : undefined
)
const linkedSource = await createSource(ROWS, undefined, {linksPerEntry: 3})
const base = new BaseEntryIndex(config)
await base.syncWith(source)
const baseResolver = new BaseEntryResolver(config, base)
const linkedBase = new BaseEntryIndex(config)
await linkedBase.syncWith(linkedSource)
const linkedResolver = new BaseEntryResolver(config, linkedBase)
const artifact = createRxbEntryArtifact(config, base, {
  configHash: 'bench-config',
  contentHash: base.sha
})
const rxbBytes = encodeRxbEntryArtifact(artifact)
const compressedRxbBytes = await compressRxbEntryBytes(rxbBytes)
const rxbDb = RxbEntryDB.open(config, rxbBytes)
const contentBytes = ContentEntryDB.fromIndex(config, base).exportBytes()
const compressedContentBytes = await compressRxbEntryBytes(contentBytes)
const contentDb = ContentEntryDB.open(config, contentBytes)
const linkedArtifact = createRxbEntryArtifact(config, linkedBase, {
  configHash: 'bench-config',
  contentHash: linkedBase.sha
})
const linkedRxbDb = RxbEntryDB.open(
  config,
  encodeRxbEntryArtifact(linkedArtifact)
)
const linkedContentBytes = ContentEntryDB.fromIndex(
  config,
  linkedBase
).exportBytes()
const linkedContentDb = ContentEntryDB.open(config, linkedContentBytes)

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

const contentBuildFresh = await benchAsync(
  'contentdb build bytes fresh',
  async () => {
    const index = new BaseEntryIndex(config)
    await index.syncWith(source)
    ContentEntryDB.fromIndex(config, index).exportBytes()
  }
)

const baseSyncNoop = await benchAsyncPrepared(
  'baseline syncWith noop',
  async () => {
    const index = new BaseEntryIndex(config)
    await index.syncWith(source)
    return index
  },
  index => index.syncWith(source)
)

const rxbSyncNoop = await benchAsyncPrepared(
  'rxb syncWith noop',
  async () => RxbEntryDB.open(config, rxbBytes),
  db => db.syncWith(source)
)

const contentSyncNoop = await benchAsyncPrepared(
  'contentdb syncWith noop',
  async () => ContentEntryDB.open(config, contentBytes),
  db => db.syncWith(source)
)

const baseSyncChanged = await benchAsyncPrepared(
  'baseline syncWith changed',
  async () => {
    const index = new BaseEntryIndex(config)
    await index.syncWith(source)
    return index
  },
  index => index.syncWith(changedSource)
)

const rxbSyncChanged = await benchAsyncPrepared(
  'rxb syncWith changed',
  async () => RxbEntryDB.open(config, rxbBytes),
  db => db.syncWith(changedSource)
)

const contentSyncChanged = await benchAsyncPrepared(
  'contentdb syncWith changed',
  async () => ContentEntryDB.open(config, contentBytes),
  db => db.syncWith(changedSource)
)

const openRxbDb = bench('open rxb db', () => {
  RxbEntryDB.open(config, rxbBytes)
})

const openContentDb = bench('open contentdb', () => {
  ContentEntryDB.open(config, contentBytes)
})

const exportRxbBytes = bench('export rxb bytes', () => {
  rxbDb.exportBytes()
})

const exportContentBytes = bench('export contentdb bytes', () => {
  contentDb.exportBytes()
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
const contentResolveById = await benchContent(
  `contentdb resolve id x${RUNS}`,
  contentDb,
  {
    id: targetId,
    select: Entry.id
  }
)

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
const contentCountByType = await benchContent(
  `contentdb count type x${RUNS}`,
  contentDb,
  {
    type: 'Page',
    count: true
  } as any
)

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
const contentScoreFilter = await benchContent(
  `contentdb score filter x${RUNS}`,
  contentDb,
  {
    type: 'Page',
    filter: {score: {gte: scoreCutoff}},
    select: Entry.id
  } as any
)

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
const contentNestedFilter = await benchContent(
  `contentdb nested filter x${RUNS}`,
  contentDb,
  {
    type: 'Page',
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

const baseDashboardChildren = await benchResolver(
  `baseline dashboard children x${RUNS}`,
  baseResolver,
  {
    workspace: 'main',
    root: 'pages',
    parentId: null,
    filter: {_type: {in: ['Page']}},
    status: 'preferDraft',
    select: {
      id: Entry.id,
      type: Entry.type,
      parentId: Entry.parentId,
      active: Entry.active
    }
  } as any
)
const rxbDashboardChildren = await benchRxb(
  `rxb dashboard children x${RUNS}`,
  rxbDb,
  {
    workspace: 'main',
    root: 'pages',
    parentId: null,
    filter: {_type: {in: ['Page']}},
    status: 'preferDraft',
    select: {
      id: Entry.id,
      type: Entry.type,
      parentId: Entry.parentId,
      active: Entry.active
    }
  } as any
)
const contentDashboardChildren = await benchContent(
  `contentdb dashboard children x${RUNS}`,
  contentDb,
  {
    workspace: 'main',
    root: 'pages',
    parentId: null,
    filter: {_type: {in: ['Page']}},
    status: 'preferDraft',
    select: {
      id: Entry.id,
      type: Entry.type,
      parentId: Entry.parentId,
      active: Entry.active
    }
  } as any
)

const baseMediaCount = await benchResolver(
  `baseline media-style count x${RUNS}`,
  baseResolver,
  {
    filter: {_root: 'pages', _workspace: 'main', _parentId: null},
    status: 'preferDraft',
    count: true
  } as any
)
const rxbMediaCount = await benchRxb(`rxb media-style count x${RUNS}`, rxbDb, {
  filter: {_root: 'pages', _workspace: 'main', _parentId: null},
  status: 'preferDraft',
  count: true
} as any)
const contentMediaCount = await benchContent(
  `contentdb media-style count x${RUNS}`,
  contentDb,
  {
    filter: {_root: 'pages', _workspace: 'main', _parentId: null},
    status: 'preferDraft',
    count: true
  } as any
)

const baseMediaBatch = await benchResolver(
  `baseline media-style batch x${RUNS}`,
  baseResolver,
  {
    filter: {_root: 'pages', _workspace: 'main', _parentId: null},
    orderBy: [{desc: Entry.type}, {desc: Entry.id}],
    status: 'preferDraft',
    take: 50,
    select: Entry.id
  } as any
)
const rxbMediaBatch = await benchRxb(`rxb media-style batch x${RUNS}`, rxbDb, {
  filter: {_root: 'pages', _workspace: 'main', _parentId: null},
  orderBy: [{desc: Entry.type}, {desc: Entry.id}],
  status: 'preferDraft',
  take: 50,
  select: Entry.id
} as any)
const contentMediaBatch = await benchContent(
  `contentdb media-style batch x${RUNS}`,
  contentDb,
  {
    filter: {_root: 'pages', _workspace: 'main', _parentId: null},
    orderBy: [{desc: Entry.type}, {desc: Entry.id}],
    status: 'preferDraft',
    take: 50,
    select: Entry.id
  } as any
)

const baseSearch = await benchResolver(
  `baseline search x${RUNS}`,
  baseResolver,
  {
    workspace: 'main',
    root: 'pages',
    search: ['Body', String(Math.floor(ROWS / 2))],
    select: Entry.id
  } as any
)
const rxbSearch = await benchRxb(`rxb search x${RUNS}`, rxbDb, {
  workspace: 'main',
  root: 'pages',
  search: ['Body', String(Math.floor(ROWS / 2))],
  select: Entry.id
} as any)
const contentSearch = await benchContent(
  `contentdb search x${RUNS}`,
  contentDb,
  {
    workspace: 'main',
    root: 'pages',
    search: ['Body', String(Math.floor(ROWS / 2))],
    select: Entry.id
  } as any
)

const baseLinkResolver = await benchResolver(
  `baseline link resolver x${RUNS}`,
  linkedResolver,
  {
    type: Page,
    take: 100,
    select: {
      id: Entry.id,
      related: Page.related
    }
  } as any
)
const rxbLinkResolver = await benchRxb(
  `rxb link resolver x${RUNS}`,
  linkedRxbDb,
  {
    type: 'Page',
    take: 100,
    select: {
      id: Entry.id,
      related: Page.related
    }
  } as any
)
const contentLinkResolver = await benchContent(
  `contentdb link resolver x${RUNS}`,
  linkedContentDb,
  {
    type: 'Page',
    take: 100,
    select: {
      id: Entry.id,
      related: Page.related
    }
  } as any
)

const rxbColdResolveById = await benchRxbCold(
  `rxb cold resolve id x${RUNS}`,
  rxbBytes,
  {
    id: targetId,
    select: Entry.id
  }
)
const contentColdResolveById = await benchContentCold(
  `contentdb cold resolve id x${RUNS}`,
  contentBytes,
  {
    id: targetId,
    select: Entry.id
  }
)
const rxbColdScoreFilter = await benchRxbCold(
  `rxb cold score filter x${RUNS}`,
  rxbBytes,
  {
    type: 'Page',
    filter: {score: {gte: scoreCutoff}},
    select: Entry.id
  } as any
)
const contentColdScoreFilter = await benchContentCold(
  `contentdb cold score filter x${RUNS}`,
  contentBytes,
  {
    type: 'Page',
    filter: {score: {gte: scoreCutoff}},
    select: Entry.id
  } as any
)
const rxbColdMediaBatch = await benchRxbCold(
  `rxb cold media-style batch x${RUNS}`,
  rxbBytes,
  {
    filter: {_root: 'pages', _workspace: 'main', _parentId: null},
    orderBy: [{desc: Entry.type}, {desc: Entry.id}],
    status: 'preferDraft',
    take: 50,
    select: Entry.id
  } as any
)
const contentColdMediaBatch = await benchContentCold(
  `contentdb cold media-style batch x${RUNS}`,
  contentBytes,
  {
    filter: {_root: 'pages', _workspace: 'main', _parentId: null},
    orderBy: [{desc: Entry.type}, {desc: Entry.id}],
    status: 'preferDraft',
    take: 50,
    select: Entry.id
  } as any
)

console.table([
  compare3(
    'fresh index/export',
    baseIndexFresh,
    rxbBuildFresh,
    contentBuildFresh
  ),
  compare3('syncWith noop', baseSyncNoop, rxbSyncNoop, contentSyncNoop),
  compare3(
    'syncWith changed',
    baseSyncChanged,
    rxbSyncChanged,
    contentSyncChanged
  ),
  single('open rxb db', openRxbDb),
  single('open contentdb', openContentDb),
  single('export rxb bytes', exportRxbBytes),
  single('export contentdb bytes', exportContentBytes)
])
console.table([
  compare3('resolve id', baseResolveById, rxbResolveById, contentResolveById),
  compare3('count type', baseCountByType, rxbCountByType, contentCountByType),
  compare3('score filter', baseScoreFilter, rxbScoreFilter, contentScoreFilter),
  compare3(
    'nested/list filter',
    baseNestedFilter,
    rxbNestedFilter,
    contentNestedFilter
  ),
  compare3(
    'dashboard children',
    baseDashboardChildren,
    rxbDashboardChildren,
    contentDashboardChildren
  ),
  compare3(
    'media-style count',
    baseMediaCount,
    rxbMediaCount,
    contentMediaCount
  ),
  compare3(
    'media-style batch',
    baseMediaBatch,
    rxbMediaBatch,
    contentMediaBatch
  ),
  compare3('search', baseSearch, rxbSearch, contentSearch),
  compare3(
    'link resolver',
    baseLinkResolver,
    rxbLinkResolver,
    contentLinkResolver
  )
])
console.table([
  compareRxbContent(
    'cold resolve id',
    rxbColdResolveById,
    contentColdResolveById
  ),
  compareRxbContent(
    'cold score filter',
    rxbColdScoreFilter,
    contentColdScoreFilter
  ),
  compareRxbContent(
    'cold media-style batch',
    rxbColdMediaBatch,
    contentColdMediaBatch
  )
])
console.table(
  sizeReport(
    rxbBytes,
    compressedRxbBytes,
    contentBytes,
    compressedContentBytes
  )
)

async function createSource(
  rows: number,
  override?: (index: number) =>
    | {
        title?: string
        body?: string
        score?: number
      }
    | undefined,
  options: {linksPerEntry?: number} = {}
) {
  const source = new MemorySource()
  const tree = await source.getTree()
  const changes = await Promise.all(
    Array.from({length: rows}, async (_, i) => {
      const id = `page-${i}`
      const path = `page-${i}`
      const patch = override?.(i)
      const title = patch?.title ?? `Page ${i}`
      const body = patch?.body ?? `Body ${i}`
      const score = patch?.score ?? i
      const related = Edit.links(Page.related)
      for (let offset = 1; offset <= (options.linksPerEntry ?? 0); offset++) {
        related.addEntry(`page-${(i + offset) % rows}`)
      }
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
                body,
                score,
                featured: i % 2 === 0,
                meta: {inner: i % 2 === 0 ? 'even' : 'odd'},
                tags: [
                  {itemId: `tag-${i % 5}`},
                  {itemId: `group-${Math.floor(i / 100)}`}
                ],
                related: related.value()
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

async function benchContent(
  name: string,
  db: ContentEntryDB,
  query: Parameters<ContentEntryDB['resolve']>[0]
) {
  return benchAsync(name, async () => {
    for (let i = 0; i < RUNS; i++) await db.resolve(query)
  })
}

async function benchRxbCold(
  name: string,
  bytes: Uint8Array,
  query: Parameters<RxbEntryDB['resolve']>[0]
) {
  return benchAsync(name, async () => {
    for (let i = 0; i < RUNS; i++)
      await RxbEntryDB.open(config, bytes).resolve(query)
  })
}

async function benchContentCold(
  name: string,
  bytes: Uint8Array,
  query: Parameters<ContentEntryDB['resolve']>[0]
) {
  return benchAsync(name, async () => {
    for (let i = 0; i < RUNS; i++)
      await ContentEntryDB.open(config, bytes).resolve(query)
  })
}

function bench(name: string, run: () => void) {
  const samples = Array<number>()
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now()
    run()
    const duration = performance.now() - start
    samples.push(duration)
    traceSample(name, i, duration)
  }
  return {name, duration: median(samples)}
}

async function benchAsync(name: string, run: () => Promise<void>) {
  const samples = Array<number>()
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now()
    await run()
    const duration = performance.now() - start
    samples.push(duration)
    traceSample(name, i, duration)
  }
  return {name, duration: median(samples)}
}

async function benchAsyncPrepared<T>(
  name: string,
  prepare: () => Promise<T>,
  run: (target: T) => Promise<unknown>
) {
  const samples = Array<number>()
  for (let i = 0; i < SAMPLES; i++) {
    const target = await prepare()
    const start = performance.now()
    await run(target)
    const duration = performance.now() - start
    samples.push(duration)
    traceSample(name, i, duration)
  }
  return {name, duration: median(samples)}
}

function traceSample(name: string, sample: number, duration: number) {
  if (!TRACE) return
  console.error(
    `[bench] ${name} sample ${sample + 1}/${SAMPLES}: ${duration.toFixed(2)}ms`
  )
}

function compare3(
  name: string,
  baseline: {duration: number},
  rxb: {duration: number},
  contentdb: {duration: number}
) {
  return {
    task: name,
    baselineMs: baseline.duration.toFixed(2),
    rxbMs: rxb.duration.toFixed(2),
    contentdbMs: contentdb.duration.toFixed(2),
    rxbVsBaseline: `${(baseline.duration / rxb.duration).toFixed(1)}x`,
    contentdbVsBaseline: `${(baseline.duration / contentdb.duration).toFixed(1)}x`,
    contentdbVsRxb: `${(rxb.duration / contentdb.duration).toFixed(1)}x`
  }
}

function compareRxbContent(
  name: string,
  rxb: {duration: number},
  contentdb: {duration: number}
) {
  return {
    task: name,
    rxbMs: rxb.duration.toFixed(2),
    contentdbMs: contentdb.duration.toFixed(2),
    contentdbVsRxb: `${(rxb.duration / contentdb.duration).toFixed(1)}x`
  }
}

function single(name: string, result: {duration: number}) {
  return {
    task: name,
    ms: result.duration.toFixed(2)
  }
}

function sizeReport(
  rxbBytes: Uint8Array,
  compressedRxbBytes: string,
  contentBytes: Uint8Array,
  compressedContentBytes: string
) {
  return [
    size('rxb bytes', rxbBytes.byteLength, rxbBytes.byteLength),
    size(
      'rxb deflate+base64',
      Buffer.byteLength(compressedRxbBytes),
      rxbBytes.byteLength
    ),
    size('contentdb bytes', contentBytes.byteLength, rxbBytes.byteLength),
    size(
      'contentdb deflate+base64',
      Buffer.byteLength(compressedContentBytes),
      Buffer.byteLength(compressedRxbBytes)
    )
  ]
}

function size(name: string, bytes: number, baselineBytes: number) {
  return {
    artifact: name,
    bytes,
    kib: (bytes / 1024).toFixed(1),
    vsBaseline: `${((bytes / baselineBytes) * 100).toFixed(1)}%`,
    bytesPerRow: (bytes / ROWS).toFixed(1)
  }
}

function median(values: Array<number>) {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
