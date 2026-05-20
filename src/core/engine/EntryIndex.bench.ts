import {
  brotliCompressSync,
  constants as zlibConstants,
  gzipSync
} from 'node:zlib'
import {
  encode as rxEncode,
  findKey as rxFindKey,
  makeCursor as rxMakeCursor,
  open as rxOpen,
  prepareKey as rxPrepareKey,
  collectChildren as rxCollectChildren,
  read as rxRead,
  resolveStr as rxResolveStr,
  rxbEncode,
  rxbOpen,
  seekChild as rxSeekChild,
  strCompare as rxStrCompare,
  type Cursor as RxCursor
} from '@creationix/rx'
import {Config, Field} from 'alinea'
import {createConfig} from '../Config.js'
import {Entry} from '../Entry.js'
import {createRecord} from '../EntryRecord.js'
import {EntryIndex as BaseEntryIndex} from '../db/EntryIndex.js'
import {EntryResolver as BaseEntryResolver} from '../db/EntryResolver.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {exportSource} from '../source/SourceExport.js'
import {
  compactEntrySnapshot,
  expandEntrySnapshot,
  packEntrySnapshot,
  unpackEntrySnapshot
} from './EntrySnapshotCodec.js'
import {MemoryEntryEngine} from './EntryEngine.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryResolver} from './EntryResolver.js'
import type {EntrySnapshot} from './EntrySnapshot.js'
import {NativeEntryIndex} from './NativeEntryIndex.js'
import {
  createRxbEntryArtifact,
  encodeRxbEntryArtifact
} from './RxbEntryArtifact.js'
import {openRxbEntryEngine} from './RxbEntryEngine.js'

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
const hydrateSnapshot = (index: EntryIndex | NativeEntryIndex) =>
  index.snapshot.graphSha

const source = await createSource(ROWS)
const updateBatch = await createUpdateBatch(source, Math.floor(ROWS / 3))
const exportedSource = await exportSource(source)
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

const engineIndexFreshSnapshot = await benchAsync(
  'engine syncWith fresh + snapshot',
  async () => {
    const index = new EntryIndex(config)
    await index.syncWith(source)
    hydrateSnapshot(index)
  }
)

const nativeIndexFresh = await benchAsync('native syncWith fresh', async () => {
  const index = new NativeEntryIndex(config)
  await index.syncWith(source)
})

const nativeIndexFreshSnapshot = await benchAsync(
  'native syncWith fresh + snapshot',
  async () => {
    const index = new NativeEntryIndex(config)
    await index.syncWith(source)
    hydrateSnapshot(index)
  }
)

const baseIndexChanges = await benchAsyncMeasured(
  'base indexChanges one row',
  async () => {
    const index = new BaseEntryIndex(config)
    await index.syncWith(source)
    return () => index.indexChanges(updateBatch)
  }
)

const engineIndexChanges = await benchAsyncMeasured(
  'engine indexChanges one row',
  async () => {
    const index = new EntryIndex(config)
    await index.syncWith(source)
    return () => index.indexChanges(updateBatch)
  }
)

const engineIndexChangesSnapshot = await benchAsyncMeasured(
  'engine indexChanges one row + snapshot',
  async () => {
    const index = new EntryIndex(config)
    await index.syncWith(source)
    hydrateSnapshot(index)
    return async () => {
      await index.indexChanges(updateBatch)
      hydrateSnapshot(index)
    }
  }
)

const nativeIndexChanges = await benchAsyncMeasured(
  'native indexChanges one row',
  async () => {
    const index = new NativeEntryIndex(config)
    await index.syncWith(source)
    return () => index.indexChanges(updateBatch)
  }
)

const nativeIndexChangesSnapshot = await benchAsyncMeasured(
  'native indexChanges one row + snapshot',
  async () => {
    const index = new NativeEntryIndex(config)
    await index.syncWith(source)
    hydrateSnapshot(index)
    return async () => {
      await index.indexChanges(updateBatch)
      hydrateSnapshot(index)
    }
  }
)

const compactSnapshot = bench('compact snapshot', () => {
  compactEntrySnapshot(engine.snapshot)
})
const packSnapshot = bench('pack snapshot', () => {
  packEntrySnapshot(engine.snapshot)
})

const compact = compactEntrySnapshot(engine.snapshot)
const packed = packEntrySnapshot(engine.snapshot)
const rxModel = createRxEntryModel(engine.snapshot)
const rxBuffer = rxEncode(rxModel, {indexThreshold: 0})
const rxbBuffer = rxbEncode(rxModel, {indexThreshold: 0})
const rxDirectModel = createRxDirectEntryModel(engine.snapshot)
const rxDirectBuffer = rxEncode(rxDirectModel, {indexThreshold: 0})
const rxbDirectBuffer = rxbEncode(rxDirectModel, {indexThreshold: 0})
const rxbEntryArtifact = createRxbEntryArtifact(engine.snapshot, {
  configHash: 'bench-config',
  contentHash: engine.snapshot.graphSha
})
const rxbEntryArtifactBuffer = encodeRxbEntryArtifact(rxbEntryArtifact)
const snapshotSizes = snapshotSizeReport(
  engine.snapshot,
  compact,
  packed,
  rxBuffer,
  rxbBuffer,
  rxDirectBuffer,
  rxbDirectBuffer,
  rxbEntryArtifactBuffer,
  exportedSource
)
const expandSnapshot = bench('expand compact snapshot', () => {
  expandEntrySnapshot(compact)
})
const hydrateMemoryEngine = bench('hydrate memory engine', () => {
  new MemoryEntryEngine({snapshot: expandEntrySnapshot(compact)})
})
const unpackPackedSnapshot = bench('unpack packed snapshot', () => {
  unpackEntrySnapshot(packed)
})
const hydratePackedMemoryEngine = bench('hydrate packed memory engine', () => {
  new MemoryEntryEngine({snapshot: unpackEntrySnapshot(packed)})
})
const encodeRxModel = bench('encode rx model', () => {
  rxEncode(rxModel, {indexThreshold: 0})
})
const openRxModel = bench('open rx model', () => {
  rxOpen(rxBuffer)
})
const encodeRxbModel = bench('encode rxb model', () => {
  rxbEncode(rxModel, {indexThreshold: 0})
})
const openRxbModel = bench('open rxb model', () => {
  rxbOpen(rxbBuffer)
})
const encodeRxDirectModel = bench('encode rx direct model', () => {
  rxEncode(rxDirectModel, {indexThreshold: 0})
})
const openRxDirectModel = bench('open rx direct model', () => {
  rxOpen(rxDirectBuffer)
})
const encodeRxbDirectModel = bench('encode rxb direct model', () => {
  rxbEncode(rxDirectModel, {indexThreshold: 0})
})
const openRxbDirectModel = bench('open rxb direct model', () => {
  rxbOpen(rxbDirectBuffer)
})
const encodeRxbEntryArtifactBench = bench('encode rxb entry artifact', () => {
  encodeRxbEntryArtifact(rxbEntryArtifact)
})
const openRxbEntryArtifactBench = bench('open rxb entry artifact', () => {
  openRxbEntryEngine(rxbEntryArtifactBuffer)
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

const baseResolveCountType = await benchAsync(
  `base resolve count type x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await baseResolver.resolve({
        type: 'Page',
        count: true
      })
    }
  }
)

const engineResolveCountType = await benchAsync(
  `engine resolve count type x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await engineResolver.resolve({
        type: 'Page',
        count: true
      })
    }
  }
)

const scoreFilterQuery = {
  filter: {
    score: {gte: scoreCutoff}
  },
  count: true
}
const baseResolveScoreFilter = await benchResolver(
  `base resolve score filter x${RUNS}`,
  baseResolver,
  scoreFilterQuery
)
const engineResolveScoreFilter = await benchResolver(
  `engine resolve score filter x${RUNS}`,
  engineResolver,
  scoreFilterQuery
)

const nestedFilterQuery = {
  type: 'Page',
  filter: {
    and: [
      {featured: true},
      {meta: {has: {inner: {is: 'even'}}}},
      {tags: {includes: {itemId: {is: 'tag-0'}}}}
    ]
  },
  select: Entry.id
}
const baseResolveNestedFilter = await benchResolver(
  `base resolve nested filter x${RUNS}`,
  baseResolver,
  nestedFilterQuery
)
const engineResolveNestedFilter = await benchResolver(
  `engine resolve nested filter x${RUNS}`,
  engineResolver,
  nestedFilterQuery
)

const orderedFieldFilterQuery = {
  type: 'Page',
  filter: {
    title: {startsWith: 'Page 2'}
  },
  orderBy: {desc: Page.score},
  take: 5,
  select: {
    id: Entry.id,
    score: Page.score
  }
}
const baseResolveOrderedFieldFilter = await benchResolver(
  `base resolve ordered field filter x${RUNS}`,
  baseResolver,
  orderedFieldFilterQuery
)
const engineResolveOrderedFieldFilter = await benchResolver(
  `engine resolve ordered field filter x${RUNS}`,
  engineResolver,
  orderedFieldFilterQuery
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

const rxbEntryEngine = openRxbEntryEngine(rxbEntryArtifactBuffer)
const rxbEntryQueryById = await benchAsync(
  `rxb entry engine query id x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await rxbEntryEngine.query({
        query: {id: targetId, select: Entry.id}
      })
    }
  }
)
const rxbEntryCountByType = await benchAsync(
  `rxb entry engine count type x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await rxbEntryEngine.query({
        query: {type: 'Page', count: true}
      })
    }
  }
)
const rxbEntryScoreFilter = await benchAsync(
  `rxb entry engine score filter x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await rxbEntryEngine.query({
        query: scoreFilterQuery as any
      })
    }
  }
)
const rxbEntryNestedFilter = await benchAsync(
  `rxb entry engine nested filter x${RUNS}`,
  async () => {
    for (let i = 0; i < RUNS; i++) {
      await rxbEntryEngine.query({
        query: nestedFilterQuery as any
      })
    }
  }
)

const rxProxy = rxOpen(rxBuffer) as RxEntryModel
const rxbProxy = rxbOpen(rxbBuffer) as RxEntryModel
const rxDirectProxy = rxOpen(rxDirectBuffer) as RxDirectEntryModel
const rxbDirectProxy = rxbOpen(rxbDirectBuffer) as RxDirectEntryModel
const rxCursorModel = openRxCursorEntryModel(rxBuffer)
const rxCachedNestedIndexes = [
  Array.from(rxProxy.fieldIndexes.exact.featured['true']),
  Array.from(rxProxy.fieldIndexes.exact['meta.inner'].even),
  Array.from(rxProxy.fieldIndexes.exact['tags.itemId']['tag-0'])
]
const rxbCachedNestedIndexes = [
  Array.from(rxbProxy.fieldIndexes.exact.featured['true']),
  Array.from(rxbProxy.fieldIndexes.exact['meta.inner'].even),
  Array.from(rxbProxy.fieldIndexes.exact['tags.itemId']['tag-0'])
]
const rxCursorCachedNestedIndexes = cacheRxCursorLeaves([
  rxCursorModel.featuredTrue,
  rxCursorModel.metaInnerEven,
  rxCursorModel.tag0
])
const rxDirectNestedIndexes = [
  Array.from(rxDirectProxy.fieldIndexes.exact.featured['true']),
  Array.from(rxDirectProxy.fieldIndexes.exact['meta.inner'].even),
  Array.from(rxDirectProxy.fieldIndexes.exact['tags.itemId']['tag-0'])
]
const rxbDirectNestedIndexes = [
  Array.from(rxbDirectProxy.fieldIndexes.exact.featured['true']),
  Array.from(rxbDirectProxy.fieldIndexes.exact['meta.inner'].even),
  Array.from(rxbDirectProxy.fieldIndexes.exact['tags.itemId']['tag-0'])
]
const rxDirectNestedSets = rxDirectNestedIndexes.map(rows => new Set(rows))
const rxbDirectNestedSets = rxbDirectNestedIndexes.map(rows => new Set(rows))

const rxQueryById = bench(`rx query id x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    const rowId = rxProxy.indexes.byId[targetId][0]
    rxProxy.rowsById[rowId].id
  }
})

const rxbQueryById = bench(`rxb query id x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    const rowId = rxbProxy.indexes.byId[targetId][0]
    rxbProxy.rowsById[rowId].id
  }
})

const rxCountByType = bench(`rx count type x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    rxProxy.indexes.byType.Page.length
  }
})

const rxbCountByType = bench(`rxb count type x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    rxbProxy.indexes.byType.Page.length
  }
})

const rxScoreRange = bench(`rx score range x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    scoreRangeCount(rxProxy.fieldIndexes.number.score, scoreCutoff)
  }
})

const rxbScoreRange = bench(`rxb score range x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    scoreRangeCount(rxbProxy.fieldIndexes.number.score, scoreCutoff)
  }
})

const rxNestedFieldIndex = bench(`rx nested field index x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    intersectSortedRowIds([
      rxProxy.fieldIndexes.exact.featured['true'],
      rxProxy.fieldIndexes.exact['meta.inner'].even,
      rxProxy.fieldIndexes.exact['tags.itemId']['tag-0']
    ])
  }
})

const rxbNestedFieldIndex = bench(`rxb nested field index x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    intersectSortedRowIds([
      rxbProxy.fieldIndexes.exact.featured['true'],
      rxbProxy.fieldIndexes.exact['meta.inner'].even,
      rxbProxy.fieldIndexes.exact['tags.itemId']['tag-0']
    ])
  }
})

const rxCachedNestedFieldIndex = bench(
  `rx cached nested field index x${RUNS}`,
  () => {
    for (let i = 0; i < RUNS; i++) {
      intersectSortedRowIds(rxCachedNestedIndexes)
    }
  }
)

const rxbCachedNestedFieldIndex = bench(
  `rxb cached nested field index x${RUNS}`,
  () => {
    for (let i = 0; i < RUNS; i++) {
      intersectSortedRowIds(rxbCachedNestedIndexes)
    }
  }
)

const rxCursorQueryById = bench(`rx cursor query id x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    rxCursorReadId(rxCursorModel, targetId)
  }
})

const rxCursorCountByType = bench(`rx cursor count type x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    rxCursorCountType(rxCursorModel, 'Page')
  }
})

const rxCursorScoreRange = bench(`rx cursor score range x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    rxCursorScoreRangeCount(rxCursorModel.score, scoreCutoff)
  }
})

const rxCursorNestedFieldIndex = bench(
  `rx cursor nested field index x${RUNS}`,
  () => {
    for (let i = 0; i < RUNS; i++) {
      intersectRxCursorRowIds([
        rxCursorModel.featuredTrue,
        rxCursorModel.metaInnerEven,
        rxCursorModel.tag0
      ])
    }
  }
)

const rxCursorCacheNestedLeaves = bench('cache rx cursor nested leaves', () => {
  cacheRxCursorLeaves([
    rxCursorModel.featuredTrue,
    rxCursorModel.metaInnerEven,
    rxCursorModel.tag0
  ])
})

const rxCursorCachedNestedFieldIndex = bench(
  `rx cursor cached nested field index x${RUNS}`,
  () => {
    for (let i = 0; i < RUNS; i++) {
      intersectSortedRowIds(rxCursorCachedNestedIndexes)
    }
  }
)

const rxDirectQueryById = bench(`rx direct query id x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    rxDirectProxy.indexes.byId[targetId].id
  }
})

const rxbDirectQueryById = bench(`rxb direct query id x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    rxbDirectProxy.indexes.byId[targetId].id
  }
})

const rxDirectScoreRange = bench(`rx direct score range x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    scoreRangeCount(rxDirectProxy.fieldIndexes.number.score, scoreCutoff)
  }
})

const rxbDirectScoreRange = bench(`rxb direct score range x${RUNS}`, () => {
  for (let i = 0; i < RUNS; i++) {
    scoreRangeCount(rxbDirectProxy.fieldIndexes.number.score, scoreCutoff)
  }
})

const rxDirectNestedFieldIndex = bench(
  `rx direct nested field index x${RUNS}`,
  () => {
    for (let i = 0; i < RUNS; i++) {
      intersectRxDirectRows(rxDirectNestedIndexes)
    }
  }
)

const rxbDirectNestedFieldIndex = bench(
  `rxb direct nested field index x${RUNS}`,
  () => {
    for (let i = 0; i < RUNS; i++) {
      intersectRxDirectRows(rxbDirectNestedIndexes)
    }
  }
)

const rxDirectCachedNestedFieldIndex = bench(
  `rx direct cached nested field index x${RUNS}`,
  () => {
    for (let i = 0; i < RUNS; i++) {
      intersectRxDirectRowSets(rxDirectNestedIndexes[0], rxDirectNestedSets)
    }
  }
)

const rxbDirectCachedNestedFieldIndex = bench(
  `rxb direct cached nested field index x${RUNS}`,
  () => {
    for (let i = 0; i < RUNS; i++) {
      intersectRxDirectRowSets(rxbDirectNestedIndexes[0], rxbDirectNestedSets)
    }
  }
)

console.log({ROWS, RUNS, SAMPLES})
console.table([
  result('fresh syncWith', baseIndexFresh, engineIndexFresh),
  compareToBase(
    'fresh syncWith + snapshot',
    baseIndexFresh,
    engineIndexFreshSnapshot
  ),
  compareToBase('native syncWith', baseIndexFresh, nativeIndexFresh),
  compareToBase(
    'native syncWith + snapshot',
    baseIndexFresh,
    nativeIndexFreshSnapshot
  ),
  result('indexChanges one row', baseIndexChanges, engineIndexChanges),
  compareToBase(
    'indexChanges one row + snapshot',
    baseIndexChanges,
    engineIndexChangesSnapshot
  ),
  compareToBase(
    'native indexChanges one row',
    baseIndexChanges,
    nativeIndexChanges
  ),
  compareToBase(
    'native indexChanges one row + snapshot',
    baseIndexChanges,
    nativeIndexChangesSnapshot
  )
])
console.table([
  singleResult('compact snapshot', compactSnapshot),
  singleResult('pack snapshot', packSnapshot),
  singleResult('expand compact snapshot', expandSnapshot),
  singleResult('hydrate memory engine', hydrateMemoryEngine),
  singleResult('unpack packed snapshot', unpackPackedSnapshot),
  singleResult('hydrate packed memory engine', hydratePackedMemoryEngine),
  singleResult('encode rx model', encodeRxModel),
  singleResult('open rx model', openRxModel),
  singleResult('encode rxb model', encodeRxbModel),
  singleResult('open rxb model', openRxbModel),
  singleResult('encode rx direct model', encodeRxDirectModel),
  singleResult('open rx direct model', openRxDirectModel),
  singleResult('encode rxb direct model', encodeRxbDirectModel),
  singleResult('open rxb direct model', openRxbDirectModel),
  singleResult('encode rxb entry artifact', encodeRxbEntryArtifactBench),
  singleResult('open rxb entry artifact', openRxbEntryArtifactBench),
  singleResult('cache rx cursor nested leaves', rxCursorCacheNestedLeaves)
])
console.table(snapshotSizes)
console.table([
  tripleResult(
    'resolve id',
    baseResolveById,
    engineResolveById,
    rxbEntryQueryById
  ),
  tripleResult(
    'resolve count type',
    baseResolveCountType,
    engineResolveCountType,
    rxbEntryCountByType
  ),
  tripleResult(
    'resolve score filter',
    baseResolveScoreFilter,
    engineResolveScoreFilter,
    rxbEntryScoreFilter
  ),
  tripleResult(
    'resolve nested filter',
    baseResolveNestedFilter,
    engineResolveNestedFilter,
    rxbEntryNestedFilter
  )
])
console.table([
  result('id', scanById, planById),
  result('type', scanByType, planByType),
  result('resolve id', baseResolveById, engineResolveById),
  result('resolve count type', baseResolveCountType, engineResolveCountType),
  result(
    'resolve score filter',
    baseResolveScoreFilter,
    engineResolveScoreFilter
  ),
  result(
    'resolve nested filter',
    baseResolveNestedFilter,
    engineResolveNestedFilter
  ),
  result(
    'resolve field filter + order',
    baseResolveOrderedFieldFilter,
    engineResolveOrderedFieldFilter
  ),
  result('memory query id', baseResolveById, memoryQueryById),
  result('memory traced id', baseResolveById, memoryQueryByIdTrace),
  result('memory count type', scanByType, memoryCountByType),
  result('rxb entry query id', baseResolveById, rxbEntryQueryById),
  result('rxb entry count type', scanByType, rxbEntryCountByType),
  result('rxb entry score filter', baseResolveScoreFilter, rxbEntryScoreFilter),
  result(
    'rxb entry nested filter',
    baseResolveNestedFilter,
    rxbEntryNestedFilter
  ),
  result('rx query id', baseResolveById, rxQueryById),
  result('rxb query id', baseResolveById, rxbQueryById),
  result('rx count type', scanByType, rxCountByType),
  result('rxb count type', scanByType, rxbCountByType),
  result('rx score range', baseResolveScoreFilter, rxScoreRange),
  result('rxb score range', baseResolveScoreFilter, rxbScoreRange),
  result('rx nested field index', baseResolveNestedFilter, rxNestedFieldIndex),
  result('rxb nested field index', baseResolveNestedFilter, rxbNestedFieldIndex),
  result(
    'rx cached nested index',
    baseResolveNestedFilter,
    rxCachedNestedFieldIndex
  ),
  result(
    'rxb cached nested index',
    baseResolveNestedFilter,
    rxbCachedNestedFieldIndex
  ),
  result('rx cursor query id', baseResolveById, rxCursorQueryById),
  result('rx cursor count type', scanByType, rxCursorCountByType),
  result('rx cursor score range', baseResolveScoreFilter, rxCursorScoreRange),
  result(
    'rx cursor nested index',
    baseResolveNestedFilter,
    rxCursorNestedFieldIndex
  ),
  result(
    'rx cursor cached nested index',
    baseResolveNestedFilter,
    rxCursorCachedNestedFieldIndex
  ),
  result('rx direct query id', baseResolveById, rxDirectQueryById),
  result('rxb direct query id', baseResolveById, rxbDirectQueryById),
  result('rx direct score range', baseResolveScoreFilter, rxDirectScoreRange),
  result('rxb direct score range', baseResolveScoreFilter, rxbDirectScoreRange),
  result(
    'rx direct nested index',
    baseResolveNestedFilter,
    rxDirectNestedFieldIndex
  ),
  result(
    'rxb direct nested index',
    baseResolveNestedFilter,
    rxbDirectNestedFieldIndex
  ),
  result(
    'rx direct cached nested index',
    baseResolveNestedFilter,
    rxDirectCachedNestedFieldIndex
  ),
  result(
    'rxb direct cached nested index',
    baseResolveNestedFilter,
    rxbDirectCachedNestedFieldIndex
  )
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
          data: pageData(i)
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
      data: pageData(
        index,
        `Updated page ${index}`,
        `Updated searchable page body ${index}`
      )
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

async function benchAsyncMeasured(
  label: string,
  setup: () => Promise<() => Promise<unknown>>
) {
  await (
    await setup()
  )()
  const durations = []
  for (let i = 0; i < SAMPLES; i++) {
    const run = await setup()
    const start = performance.now()
    await run()
    durations.push(performance.now() - start)
  }
  return {label, duration: median(durations), durations}
}

async function benchResolver(
  label: string,
  resolver: BaseEntryResolver | EntryResolver,
  query: Record<string, unknown>
) {
  return benchAsync(label, async () => {
    for (let i = 0; i < RUNS; i++) {
      await resolver.resolve(query as any)
    }
  })
}

function pageData(
  index: number,
  title = `Page ${index}`,
  body = `Searchable page body ${index}`
) {
  return {
    title,
    body,
    score: index,
    featured: index % 2 === 0,
    meta: {
      inner: index % 2 === 0 ? 'even' : 'odd'
    },
    tags: [
      {itemId: `tag-${index % 10}`},
      {itemId: index % 2 === 0 ? 'even' : 'odd'}
    ]
  }
}

interface RxEntryModel {
  rowsById: Record<string, RxEntryRow>
  indexes: {
    byId: Record<string, Array<string>>
    byType: Record<string, Array<string>>
  }
  fieldIndexes: {
    exact: Record<string, Record<string, Array<string>>>
    number: Record<string, Array<[number, string]>>
  }
}

interface RxDirectEntryModel {
  rowsById: Record<string, RxDirectEntryRow>
  indexes: {
    byId: Record<string, RxDirectEntryRow>
    byType: Record<string, Array<RxDirectEntryRow>>
  }
  fieldIndexes: {
    exact: Record<string, Record<string, Array<RxDirectEntryRow>>>
    number: Record<string, Array<[number, RxDirectEntryRow]>>
  }
}

interface RxEntryRow {
  rowId: string
  id: string
  type: string
  status: string
  locale: string | null
  path: string
  score: number
  title: string
}

type RxDirectEntryRow = RxEntryRow

interface RxCursorEntryModel {
  root: RxCursor
  rowsById: RxCursor
  byId: RxCursor
  byType: RxCursor
  score: RxCursor
  featuredTrue: RxCursor
  metaInnerEven: RxCursor
  tag0: RxCursor
}

function openRxCursorEntryModel(buffer: Uint8Array): RxCursorEntryModel {
  const root = rxMakeCursor(buffer)
  rxRead(root)
  const rowsById = rxCursorAtKey(root, 'rowsById')
  const indexes = rxCursorAtKey(root, 'indexes')
  const fieldIndexes = rxCursorAtKey(root, 'fieldIndexes')
  const byId = rxCursorAtKey(indexes, 'byId')
  const byType = rxCursorAtKey(indexes, 'byType')
  const exact = rxCursorAtKey(fieldIndexes, 'exact')
  const number = rxCursorAtKey(fieldIndexes, 'number')
  return {
    root,
    rowsById,
    byId,
    byType,
    score: rxCursorAtKey(number, 'score'),
    featuredTrue: rxCursorAtKey(rxCursorAtKey(exact, 'featured'), 'true'),
    metaInnerEven: rxCursorAtKey(rxCursorAtKey(exact, 'meta.inner'), 'even'),
    tag0: rxCursorAtKey(rxCursorAtKey(exact, 'tags.itemId'), 'tag-0')
  }
}

function rxCursorReadId(model: RxCursorEntryModel, id: string): string {
  const rowIds = rxCursorAtKey(model.byId, id)
  const rowId = rxCursorStringAt(rowIds, 0)
  const row = rxCursorAtKey(model.rowsById, rowId)
  return rxResolveStr(rxCursorAtKey(row, 'id'))
}

function rxCursorCountType(model: RxCursorEntryModel, type: string): number {
  return rxCursorLength(rxCursorAtKey(model.byType, type))
}

function rxCursorScoreRangeCount(index: RxCursor, min: number): number {
  let low = 0
  let high = rxCursorLength(index)
  const pair = rxMakeCursor(index.data)
  const score = rxMakeCursor(index.data)
  while (low < high) {
    const mid = (low + high) >>> 1
    rxSeekChild(pair, index, mid)
    rxResolveCursor(pair)
    rxSeekChild(score, pair, 0)
    rxResolveCursor(score)
    if (score.val < min) low = mid + 1
    else high = mid
  }
  return rxCursorLength(index) - low
}

function intersectRxCursorRowIds(inputs: Array<RxCursor>): number {
  const sorted = inputs
    .slice()
    .sort((a, b) => rxCursorLength(a) - rxCursorLength(b))
  const [first, ...rest] = sorted
  if (!first) return 0
  let count = 0
  const row = rxMakeCursor(first.data)
  for (let index = 0; index < rxCursorLength(first); index++) {
    rxSeekChild(row, first, index)
    rxResolveCursor(row)
    const rowId = rxResolveStr(row)
    if (rest.every(input => rxCursorSortedIncludes(input, rowId))) count++
  }
  return count
}

function cacheRxCursorLeaves(inputs: Array<RxCursor>): Array<Array<string>> {
  return inputs.map(input => {
    const rows = Array<string>()
    const row = rxMakeCursor(input.data)
    for (let index = 0; index < rxCursorLength(input); index++) {
      rxSeekChild(row, input, index)
      rxResolveCursor(row)
      rows.push(rxResolveStr(row))
    }
    return rows
  })
}

function rxCursorSortedIncludes(input: RxCursor, value: string): boolean {
  const target = rxPrepareKey(value)
  const item = rxMakeCursor(input.data)
  let low = 0
  let high = rxCursorLength(input)
  while (low < high) {
    const mid = (low + high) >>> 1
    rxSeekChild(item, input, mid)
    rxResolveCursor(item)
    const compare = rxStrCompare(item, target)
    if (compare < 0) low = mid + 1
    else high = mid
  }
  if (low >= rxCursorLength(input)) return false
  rxSeekChild(item, input, low)
  rxResolveCursor(item)
  return rxStrCompare(item, target) === 0
}

function rxCursorStringAt(input: RxCursor, index: number): string {
  const item = rxMakeCursor(input.data)
  rxSeekChild(item, input, index)
  rxResolveCursor(item)
  return rxResolveStr(item)
}

function rxCursorAtKey(container: RxCursor, key: string): RxCursor {
  const result = rxMakeCursor(container.data)
  if (!rxFindKey(result, container, key)) {
    throw new Error(`Missing RX cursor key: ${key}`)
  }
  rxResolveCursor(result)
  return result
}

function rxCursorLength(input: RxCursor): number {
  if (input.ixWidth > 0) return input.ixCount
  const offsets: Array<number> = []
  return rxCollectChildren(input, offsets)
}

function rxResolveCursor(input: RxCursor): RxCursor {
  while (input.tag === 'ptr') {
    input.right = input.val
    rxRead(input)
  }
  return input
}

function createRxEntryModel(snapshot: EntrySnapshot): RxEntryModel {
  const rowsById: Record<string, RxEntryRow> = {}
  const exact: RxEntryModel['fieldIndexes']['exact'] = {
    featured: {},
    'meta.inner': {},
    'tags.itemId': {},
    title: {}
  }
  const score = Array<[number, string]>()

  for (const row of snapshot.rows.versions) {
    const rowId = row.rowId
    rowsById[rowId] = {
      rowId,
      id: row.id,
      type: row.type,
      status: row.status,
      locale: row.locale,
      path: row.path,
      score: Number(row.data.score ?? 0),
      title: String(row.data.title ?? row.title)
    }
    addExact(exact, 'featured', String(Boolean(row.data.featured)), rowId)
    addExact(exact, 'title', String(row.data.title ?? row.title), rowId)
    const meta = row.data.meta
    if (isRecord(meta) && typeof meta.inner === 'string')
      addExact(exact, 'meta.inner', meta.inner, rowId)
    const tags = row.data.tags
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (isRecord(tag) && typeof tag.itemId === 'string')
          addExact(exact, 'tags.itemId', tag.itemId, rowId)
      }
    }
    if (typeof row.data.score === 'number') score.push([row.data.score, rowId])
  }

  for (const values of Object.values(exact)) {
    for (const rows of Object.values(values)) rows.sort(compareRowIds)
  }
  score.sort((a, b) => a[0] - b[0] || compareRowIds(a[1], b[1]))

  return {
    rowsById,
    indexes: {
      byId: snapshot.indexes.byId,
      byType: snapshot.indexes.byType
    },
    fieldIndexes: {
      exact,
      number: {score}
    }
  }
}

function createRxDirectEntryModel(snapshot: EntrySnapshot): RxDirectEntryModel {
  const rowsById: Record<string, RxDirectEntryRow> = {}
  const byId: Record<string, RxDirectEntryRow> = {}
  const byType: Record<string, Array<RxDirectEntryRow>> = {}
  const exact: RxDirectEntryModel['fieldIndexes']['exact'] = {
    featured: {},
    'meta.inner': {},
    'tags.itemId': {},
    title: {}
  }
  const score = Array<[number, RxDirectEntryRow]>()

  for (const row of snapshot.rows.versions) {
    const entry = {
      rowId: row.rowId,
      id: row.id,
      type: row.type,
      status: row.status,
      locale: row.locale,
      path: row.path,
      score: Number(row.data.score ?? 0),
      title: String(row.data.title ?? row.title)
    }
    rowsById[row.rowId] = entry
    byId[row.id] = entry
    ;(byType[row.type] ??= []).push(entry)
    addDirectExact(exact, 'featured', String(Boolean(row.data.featured)), entry)
    addDirectExact(exact, 'title', String(row.data.title ?? row.title), entry)
    const meta = row.data.meta
    if (isRecord(meta) && typeof meta.inner === 'string')
      addDirectExact(exact, 'meta.inner', meta.inner, entry)
    const tags = row.data.tags
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (isRecord(tag) && typeof tag.itemId === 'string')
          addDirectExact(exact, 'tags.itemId', tag.itemId, entry)
      }
    }
    if (typeof row.data.score === 'number') score.push([row.data.score, entry])
  }

  for (const values of Object.values(exact)) {
    for (const rows of Object.values(values))
      rows.sort((a, b) => compareRowIds(a.rowId, b.rowId))
  }
  score.sort((a, b) => a[0] - b[0] || compareRowIds(a[1].rowId, b[1].rowId))

  return {
    rowsById,
    indexes: {byId, byType},
    fieldIndexes: {
      exact,
      number: {score}
    }
  }
}

function addExact(
  indexes: RxEntryModel['fieldIndexes']['exact'],
  field: string,
  value: string,
  rowId: string
) {
  const byValue = (indexes[field] ??= {})
  const rows = (byValue[value] ??= [])
  rows.push(rowId)
}

function addDirectExact(
  indexes: RxDirectEntryModel['fieldIndexes']['exact'],
  field: string,
  value: string,
  row: RxDirectEntryRow
) {
  const byValue = (indexes[field] ??= {})
  const rows = (byValue[value] ??= [])
  rows.push(row)
}

function scoreRangeCount(index: Array<[number, unknown]>, min: number): number {
  let low = 0
  let high = index.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (index[mid][0] < min) low = mid + 1
    else high = mid
  }
  return index.length - low
}

function intersectSortedRowIds(inputs: Array<Array<string>>): number {
  const [first, ...rest] = inputs.sort((a, b) => a.length - b.length)
  if (!first) return 0
  let count = 0
  for (const rowId of first) {
    if (rest.every(input => sortedIncludes(input, rowId))) count++
  }
  return count
}

function intersectRxDirectRows(inputs: Array<Array<RxDirectEntryRow>>): number {
  const [first, ...rest] = inputs.slice().sort((a, b) => a.length - b.length)
  if (!first) return 0
  const sets = rest.map(rows => new Set(rows))
  let count = 0
  for (const row of first) {
    if (sets.every(set => set.has(row))) count++
  }
  return count
}

function intersectRxDirectRowSets(
  first: Array<RxDirectEntryRow>,
  sets: Array<Set<RxDirectEntryRow>>
): number {
  let count = 0
  for (const row of first) {
    if (sets.every(set => set.has(row))) count++
  }
  return count
}

function sortedIncludes(input: Array<string>, value: string): boolean {
  let low = 0
  let high = input.length
  while (low < high) {
    const mid = (low + high) >>> 1
    const compare = compareRowIds(input[mid], value)
    if (compare < 0) low = mid + 1
    else high = mid
  }
  return input[low] === value
}

function compareRowIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object')
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

function compareToBase(
  name: string,
  base: {duration: number},
  engine: {duration: number}
) {
  return result(name, base, engine)
}

function tripleResult(
  name: string,
  base: {duration: number},
  engine: {duration: number},
  rxb: {duration: number}
) {
  return {
    query: name,
    baselineMs: base.duration.toFixed(2),
    engineMs: engine.duration.toFixed(2),
    rxbMs: rxb.duration.toFixed(2),
    engineVsBaseline: `${(base.duration / engine.duration).toFixed(1)}x`,
    rxbVsBaseline: `${(base.duration / rxb.duration).toFixed(1)}x`,
    rxbVsEngine: `${(engine.duration / rxb.duration).toFixed(1)}x`
  }
}

function singleResult(name: string, result: {duration: number}) {
  return {
    task: name,
    ms: result.duration.toFixed(2)
  }
}

function snapshotSizeReport(
  snapshot: EntryIndex['snapshot'],
  compact: unknown,
  packed: unknown,
  rxBuffer: Uint8Array,
  rxbBuffer: Uint8Array,
  rxDirectBuffer: Uint8Array,
  rxbDirectBuffer: Uint8Array,
  rxbEntryArtifactBuffer: Uint8Array,
  exportedSource: unknown
) {
  const exportJson = bytesOfJson(exportedSource)
  const fullJson = bytesOfJson(snapshot)
  const compactJson = bytesOfJson(compact)
  const packedJson = bytesOfJson(packed)
  const compactBuffer = Buffer.from(JSON.stringify(compact))
  const packedBuffer = Buffer.from(JSON.stringify(packed))
  const gzip = gzipSync(compactBuffer, {level: 9}).byteLength
  const packedGzip = gzipSync(packedBuffer, {level: 9}).byteLength
  const brotli = brotliCompressSync(compactBuffer, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11
    }
  }).byteLength
  return [
    sizeResult('exportSource json', exportJson, exportJson),
    sizeResult('full snapshot json', fullJson, exportJson),
    sizeResult('compact snapshot json', compactJson, exportJson),
    sizeResult('packed snapshot json', packedJson, exportJson),
    sizeResult('rx model', rxBuffer.byteLength, exportJson),
    sizeResult('rxb model', rxbBuffer.byteLength, exportJson),
    sizeResult('rx direct model', rxDirectBuffer.byteLength, exportJson),
    sizeResult('rxb direct model', rxbDirectBuffer.byteLength, exportJson),
    sizeResult(
      'rxb entry artifact',
      rxbEntryArtifactBuffer.byteLength,
      exportJson
    ),
    sizeResult('compact snapshot gzip -9', gzip, exportJson),
    sizeResult('packed snapshot gzip -9', packedGzip, exportJson),
    sizeResult(
      'rx model gzip -9',
      gzipSync(rxBuffer, {level: 9}).byteLength,
      exportJson
    ),
    sizeResult(
      'rxb model gzip -9',
      gzipSync(rxbBuffer, {level: 9}).byteLength,
      exportJson
    ),
    sizeResult(
      'rx direct model gzip -9',
      gzipSync(rxDirectBuffer, {level: 9}).byteLength,
      exportJson
    ),
    sizeResult(
      'rxb direct model gzip -9',
      gzipSync(rxbDirectBuffer, {level: 9}).byteLength,
      exportJson
    ),
    sizeResult(
      'rxb entry artifact gzip -9',
      gzipSync(rxbEntryArtifactBuffer, {level: 9}).byteLength,
      exportJson
    ),
    sizeResult('compact snapshot brotli q11', brotli, exportJson)
  ]
}

function sizeResult(name: string, bytes: number, exportBytes: number) {
  return {
    snapshot: name,
    bytes,
    kib: (bytes / 1024).toFixed(1),
    vsExport: `${((bytes / exportBytes) * 100).toFixed(1)}%`,
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
