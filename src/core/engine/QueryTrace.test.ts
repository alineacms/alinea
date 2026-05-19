import {suite} from '@alinea/suite'
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
  materializeEntry,
  type EntryLanguageRow,
  type EntryNodeRow,
  type EntrySnapshot,
  type EntryVersionRow
} from './index.js'

const test = suite(import.meta)

function createSnapshot(): EntrySnapshot {
  return {
    version: ENTRY_SNAPSHOT_VERSION,
    manifest: {version: 1, workspaces: {}, types: {}},
    graphSha: 'sha-a',
    tree: {sha: 'sha-a', tree: []},
    rows: {versions: [], languages: [], nodes: []},
    indexes: {
      byId: {},
      byFilePath: {},
      byDir: {},
      byParent: {},
      byType: {},
      byWorkspace: {},
      byRoot: {},
      byLocale: {},
      byStatus: {}
    }
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

test('engine scaffold can return an empty traced query result', async () => {
  const snapshot = createSnapshot()
  const engine = new MemoryEntryEngine({snapshot})
  const result = await engine.query({query: {}}, {trace: true})

  test.is(result.value, undefined)
  test.is(result.trace.graphSha, 'sha-a')
  test.is(engine.exportSnapshot(), snapshot)
  test.is(engine.graphSha, snapshot.graphSha)
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
