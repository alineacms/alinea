import {suite} from '@alinea/suite'
import {Entry} from '../Entry.js'
import {Expr} from '../Expr.js'
import {
  createQueryTrace,
  emptyQueryTrace,
  mergeQueryTraces,
  queryTracesOverlap,
  serializeQueryTrace,
  traceIndex,
  traceNode,
  traceRow
} from './QueryTrace.js'
import {
  ENTRY_SNAPSHOT_VERSION,
  MemoryEntryEngine,
  createEntrySnapshotIndexes,
  materializeEntry,
  type EntryLanguageRow,
  type EntryNodeRow,
  type EntryRowStore,
  type EntrySnapshot,
  type EntryVersionRow
} from './index.js'

const test = suite(import.meta)

function createRows(): EntryRowStore {
  return {
    versions: [
      {
        rowId: 'home:published',
        versionId: 'home:published',
        nodeId: 'home',
        languageId: 'home:<null>',
        id: 'home',
        type: 'Page',
        index: 'a1',
        title: 'Home',
        searchableText: 'Home page',
        seeded: null,
        rowHash: 'home:row',
        fileHash: 'home:file',
        data: {title: 'Home'},
        status: 'published',
        locale: null,
        workspace: 'main',
        root: 'pages',
        path: 'home',
        parentDir: 'pages',
        childrenDir: 'pages/home',
        filePath: 'pages/home.json',
        level: 0
      },
      {
        rowId: 'about:published',
        versionId: 'about:published',
        nodeId: 'about',
        languageId: 'about:<null>',
        id: 'about',
        type: 'Page',
        index: 'a2',
        title: 'About',
        searchableText: 'About page',
        seeded: null,
        rowHash: 'about:row',
        fileHash: 'about:file',
        data: {title: 'About'},
        status: 'published',
        locale: null,
        workspace: 'main',
        root: 'pages',
        path: 'about',
        parentDir: 'pages',
        childrenDir: 'pages/about',
        filePath: 'pages/about.json',
        level: 0
      },
      {
        rowId: 'about:draft',
        versionId: 'about:draft',
        nodeId: 'about',
        languageId: 'about:<null>',
        id: 'about',
        type: 'Page',
        index: 'a2',
        title: 'About draft',
        searchableText: 'About draft page',
        seeded: null,
        rowHash: 'about-draft:row',
        fileHash: 'about-draft:file',
        data: {title: 'About draft'},
        status: 'draft',
        locale: null,
        workspace: 'main',
        root: 'pages',
        path: 'about',
        parentDir: 'pages',
        childrenDir: 'pages/about',
        filePath: 'pages/about.draft.json',
        level: 0
      }
    ],
    languages: [
      {
        languageId: 'home:<null>',
        nodeId: 'home',
        locale: null,
        parentDir: 'pages',
        selfDir: 'pages/home',
        activeRowId: 'home:published',
        mainRowId: 'home:published',
        url: '/home',
        path: 'home',
        seeded: null,
        versionRowIds: ['home:published']
      },
      {
        languageId: 'about:<null>',
        nodeId: 'about',
        locale: null,
        parentDir: 'pages',
        selfDir: 'pages/about',
        activeRowId: 'about:draft',
        mainRowId: 'about:published',
        url: '/about',
        path: 'about',
        seeded: null,
        versionRowIds: ['about:published', 'about:draft']
      }
    ],
    nodes: [
      {
        nodeId: 'home',
        id: 'home',
        index: 'a1',
        parentId: null,
        parents: [],
        workspace: 'main',
        root: 'pages',
        type: 'Page',
        level: 0,
        languageIds: ['home:<null>'],
        childNodeIds: []
      },
      {
        nodeId: 'about',
        id: 'about',
        index: 'a2',
        parentId: null,
        parents: [],
        workspace: 'main',
        root: 'pages',
        type: 'Page',
        level: 0,
        languageIds: ['about:<null>'],
        childNodeIds: []
      }
    ]
  }
}

function createSnapshot(rows: EntryRowStore = createRows()): EntrySnapshot {
  return {
    version: ENTRY_SNAPSHOT_VERSION,
    manifest: {version: 1, workspaces: {}, types: {}},
    graphSha: 'sha-a',
    tree: {sha: 'sha-a', tree: []},
    rows,
    indexes: createEntrySnapshotIndexes(rows)
  }
}

test('query traces merge and serialize dependencies', () => {
  const base = createQueryTrace({
    graphSha: 'sha-a',
    rows: ['row-1'],
    nodes: ['node-1'],
    indexes: ['type:Page']
  })
  const extra = traceIndex(
    traceNode(traceRow(base, 'row-2'), 'node-2'),
    'parent:x'
  )
  const serialized = serializeQueryTrace(extra)

  test.equal(serialized, {
    graphSha: 'sha-a',
    rows: ['row-1', 'row-2'],
    nodes: ['node-1', 'node-2'],
    indexes: ['type:Page', 'parent:x']
  })

  const merged = mergeQueryTraces(base, createQueryTrace({rows: ['row-3']}))
  test.ok(merged.rows.has('row-1'))
  test.ok(merged.rows.has('row-3'))
})

test('query traces drop graph sha when merging different snapshots', () => {
  const merged = mergeQueryTraces(
    createQueryTrace({graphSha: 'sha-a', rows: ['row-1']}),
    createQueryTrace({graphSha: 'sha-b', rows: ['row-2']})
  )

  test.is(merged.graphSha, undefined)
  test.equal(Array.from(merged.rows), ['row-1', 'row-2'])
})

test('query traces overlap conservatively', () => {
  const rowRead = createQueryTrace({graphSha: 'sha-a', rows: ['row-1']})
  const sameRow = createQueryTrace({graphSha: 'sha-a', rows: ['row-1']})
  const sameIndex = createQueryTrace({
    graphSha: 'sha-a',
    indexes: ['search:foo']
  })
  const indexChange = createQueryTrace({
    graphSha: 'sha-a',
    indexes: ['search:foo']
  })
  const different = createQueryTrace({graphSha: 'sha-a', rows: ['row-2']})
  const differentSha = createQueryTrace({graphSha: 'sha-b'})

  test.is(queryTracesOverlap(rowRead, sameRow), true)
  test.is(queryTracesOverlap(sameIndex, indexChange), true)
  test.is(queryTracesOverlap(rowRead, different), false)
  test.is(queryTracesOverlap(rowRead, differentSha), true)
  test.is(queryTracesOverlap(emptyQueryTrace('sha-a'), different), false)
})

test('memory entry engine returns materialized query results with traces', async () => {
  const snapshot = createSnapshot()
  const engine = new MemoryEntryEngine({snapshot})
  const result = await engine.query<Array<{id: string}>>(
    {query: {type: 'Page', take: 1}},
    {trace: true}
  )

  test.equal(
    result.value.map(entry => entry.id),
    ['home']
  )
  test.is(result.trace.graphSha, 'sha-a')
  test.ok(result.trace.rows.has('home:published'))
  test.ok(result.trace.indexes.has('type:Page'))
  test.ok(result.trace.nodes.has('home'))
  test.is(engine.exportSnapshot(), snapshot)
  test.is(engine.graphSha, snapshot.graphSha)
})

test('memory entry engine applies count and first result modes', async () => {
  const engine = new MemoryEntryEngine({snapshot: createSnapshot()})

  test.is(
    await engine.query<number>({
      query: {type: 'Page', count: true, skip: 1}
    }),
    1
  )
  test.is(
    (
      await engine.query<{id: string} | null>({
        query: {type: 'Page', first: true, skip: 1}
      })
    )?.id,
    'about'
  )
})

test('memory entry engine applies preferred status modes', async () => {
  const engine = new MemoryEntryEngine({snapshot: createSnapshot()})

  test.is(
    await engine.query({
      query: {
        id: 'about',
        status: 'preferDraft',
        get: true,
        select: Entry.status
      }
    }),
    'draft'
  )
  test.is(
    await engine.query({
      query: {
        id: 'about',
        status: 'preferPublished',
        get: true,
        select: Entry.status
      }
    }),
    'published'
  )
})

test('memory entry engine applies preferred locale filtering', async () => {
  const rows = createRows()
  rows.versions.push({
    rowId: 'home:en',
    versionId: 'home:en',
    nodeId: 'home',
    languageId: 'home:en',
    id: 'home',
    type: 'Page',
    index: 'a1',
    title: 'Home EN',
    searchableText: 'Home English page',
    seeded: null,
    rowHash: 'home-en:row',
    fileHash: 'home-en:file',
    data: {title: 'Home EN'},
    status: 'published',
    locale: 'en',
    workspace: 'main',
    root: 'pages',
    path: 'home',
    parentDir: 'pages',
    childrenDir: 'pages/home',
    filePath: 'pages/home.en.json',
    level: 0
  })
  rows.languages.push({
    languageId: 'home:en',
    nodeId: 'home',
    locale: 'en',
    parentDir: 'pages',
    selfDir: 'pages/home',
    activeRowId: 'home:en',
    mainRowId: 'home:en',
    url: '/en/home',
    path: 'home',
    seeded: null,
    versionRowIds: ['home:en']
  })
  rows.nodes[0].languageIds.push('home:en')

  const engine = new MemoryEntryEngine({snapshot: createSnapshot(rows)})

  test.equal(
    await engine.query({
      query: {
        id: 'home',
        preferredLocale: 'EN',
        select: Entry.locale
      }
    }),
    [null, 'en']
  )
})

test('memory entry engine projects supported entry fields', async () => {
  const engine = new MemoryEntryEngine({snapshot: createSnapshot()})

  test.equal(
    await engine.query({
      query: {
        type: 'Page',
        take: 1,
        select: {
          id: Entry.id,
          nested: {url: Entry.url}
        }
      }
    }),
    [{id: 'home', nested: {url: '/home'}}]
  )
  test.is(
    await engine.query({
      query: {id: 'about', get: true, select: Entry.path}
    }),
    'about'
  )
})

test('memory entry engine orders by supported entry fields', async () => {
  const engine = new MemoryEntryEngine({snapshot: createSnapshot()})

  test.equal(
    await engine.query({
      query: {
        type: 'Page',
        orderBy: {desc: Entry.title},
        select: Entry.id
      }
    }),
    ['home', 'about']
  )
  test.equal(
    await engine.query({
      query: {
        type: 'Page',
        orderBy: {asc: Entry.title},
        take: 1,
        select: Entry.id
      }
    }),
    ['about']
  )
})

test('memory entry engine groups by supported entry fields', async () => {
  const engine = new MemoryEntryEngine({snapshot: createSnapshot()})

  test.equal(
    await engine.query({
      query: {
        status: 'all',
        type: 'Page',
        groupBy: Entry.id,
        orderBy: {asc: Entry.id},
        select: Entry.id
      }
    }),
    ['about', 'home']
  )
  test.is(
    await engine.query({
      query: {
        status: 'all',
        type: 'Page',
        groupBy: Entry.id,
        count: true
      }
    }),
    2
  )
})

test('memory entry engine rejects grouping that needs live scope', async () => {
  const title = new Expr({type: 'field'})
  const engine = new MemoryEntryEngine({snapshot: createSnapshot()})

  await test.throws(
    () =>
      engine.query({
        query: {status: 'all', type: 'Page', groupBy: title}
      }),
    'groupBy field'
  )
})

test('memory entry engine rejects projections that need live scope', async () => {
  const title = new Expr({type: 'field'})
  const engine = new MemoryEntryEngine({snapshot: createSnapshot()})

  await test.throws(
    () =>
      engine.query({
        query: {id: 'home', select: title}
      }),
    'projection field'
  )
  await test.throws(
    () =>
      engine.query({
        query: {id: 'home', orderBy: {asc: title}}
      }),
    'orderBy field'
  )
})

test('engine scaffold rejects change application until implemented', async () => {
  const engine = new MemoryEntryEngine({snapshot: createSnapshot()})

  await test.throws(
    () => engine.applyChanges({fromSha: 'sha-a', changes: []}),
    'not implemented'
  )
})

test('materializeEntry preserves current Entry shape semantics', () => {
  const version: EntryVersionRow = {
    rowId: 'row-draft',
    versionId: 'version-draft',
    nodeId: 'entry-1',
    languageId: 'entry-1:null',
    id: 'entry-1',
    type: 'Page',
    index: 'a1',
    title: 'Draft title',
    searchableText: 'Draft title body',
    seeded: null,
    rowHash: 'row-sha',
    fileHash: 'file-sha',
    data: {title: 'Draft title'},
    status: 'draft',
    locale: null,
    workspace: 'main',
    root: 'pages',
    path: 'draft-title',
    parentDir: 'pages',
    childrenDir: 'pages/draft-title',
    filePath: 'pages/draft-title.draft.json',
    level: 0
  }
  const language: EntryLanguageRow = {
    languageId: 'entry-1:null',
    nodeId: 'entry-1',
    locale: null,
    parentDir: 'pages',
    selfDir: 'pages/draft-title',
    activeRowId: 'row-draft',
    mainRowId: 'row-published',
    inheritedStatus: 'archived',
    url: '/draft-title',
    path: 'draft-title',
    seeded: null,
    versionRowIds: ['row-published', 'row-draft']
  }
  const node: EntryNodeRow = {
    nodeId: 'entry-1',
    id: 'entry-1',
    index: 'a1',
    parentId: 'parent-1',
    parents: ['root-1', 'parent-1'],
    workspace: 'main',
    root: 'pages',
    type: 'Page',
    level: 1,
    languageIds: ['entry-1:null'],
    childNodeIds: ['child-1']
  }

  const entry = materializeEntry({version, language, node})

  test.is(entry.id, 'entry-1')
  test.is(entry.status, 'archived')
  test.is(entry.parentId, 'parent-1')
  test.equal(entry.parents, ['root-1', 'parent-1'])
  test.is(entry.url, '/draft-title')
  test.is(entry.active, true)
  test.is(entry.main, false)
})
