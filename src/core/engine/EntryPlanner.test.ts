import {suite} from '@alinea/suite'
import {
  createEntrySnapshotIndexes,
  ENTRY_SNAPSHOT_VERSION,
  indexKey,
  indexValue,
  NULL_INDEX_VALUE,
  SnapshotEntryPlanner,
  type EntryRowStore,
  type EntrySnapshot,
  type EntryVersionRow
} from './index.js'

const test = suite(import.meta)

function version(
  rowId: string,
  input: Partial<EntryVersionRow> = {}
): EntryVersionRow {
  const id = input.id ?? rowId
  const nodeId = input.nodeId ?? id
  const path = input.path ?? id
  const status = input.status ?? 'published'
  const parentDir = input.parentDir ?? 'pages'
  return {
    rowId,
    versionId: `${rowId}:version`,
    nodeId,
    languageId: `${nodeId}:null`,
    id,
    type: input.type ?? 'Page',
    index: input.index ?? 'a1',
    title: input.title ?? path,
    searchableText: input.searchableText ?? path,
    seeded: input.seeded ?? null,
    rowHash: input.rowHash ?? `${rowId}:row-hash`,
    fileHash: input.fileHash ?? `${rowId}:file-hash`,
    data: input.data ?? {title: path},
    status,
    locale: input.locale ?? null,
    workspace: input.workspace ?? 'main',
    root: input.root ?? 'pages',
    path,
    parentDir,
    childrenDir: input.childrenDir ?? `${parentDir}/${path}`,
    filePath:
      input.filePath ??
      `${parentDir}/${path}${status === 'published' ? '' : `.${status}`}.json`,
    level: input.level ?? 0
  }
}

function createRows(): EntryRowStore {
  return {
    versions: [
      version('home:published', {id: 'home', nodeId: 'home', path: 'home'}),
      version('child:published', {
        id: 'child',
        nodeId: 'child',
        path: 'child',
        parentDir: 'pages/home',
        level: 1
      }),
      version('child:draft', {
        id: 'child',
        nodeId: 'child',
        path: 'child',
        parentDir: 'pages/home',
        status: 'draft',
        level: 1
      }),
      version('asset:published', {
        id: 'asset',
        nodeId: 'asset',
        type: 'MediaFile',
        path: 'asset',
        root: 'media'
      })
    ],
    languages: [
      {
        languageId: 'home:null',
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
        languageId: 'child:null',
        nodeId: 'child',
        locale: null,
        parentDir: 'pages/home',
        selfDir: 'pages/home/child',
        activeRowId: 'child:draft',
        mainRowId: 'child:published',
        url: '/home/child',
        path: 'child',
        seeded: null,
        versionRowIds: ['child:published', 'child:draft']
      },
      {
        languageId: 'asset:null',
        nodeId: 'asset',
        locale: null,
        parentDir: 'media',
        selfDir: 'media/asset',
        activeRowId: 'asset:published',
        mainRowId: 'asset:published',
        url: '/media/asset',
        path: 'asset',
        seeded: null,
        versionRowIds: ['asset:published']
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
        languageIds: ['home:null'],
        childNodeIds: ['child']
      },
      {
        nodeId: 'child',
        id: 'child',
        index: 'a1',
        parentId: 'home',
        parents: ['home'],
        workspace: 'main',
        root: 'pages',
        type: 'Page',
        level: 1,
        languageIds: ['child:null'],
        childNodeIds: []
      },
      {
        nodeId: 'asset',
        id: 'asset',
        index: 'a1',
        parentId: null,
        parents: [],
        workspace: 'main',
        root: 'media',
        type: 'MediaFile',
        level: 0,
        languageIds: ['asset:null'],
        childNodeIds: []
      }
    ]
  }
}

function createSnapshot(rows = createRows()): EntrySnapshot {
  return {
    version: ENTRY_SNAPSHOT_VERSION,
    manifest: {version: 1, workspaces: {}, types: {}},
    graphSha: 'sha-a',
    tree: {sha: 'sha-a', tree: []},
    rows,
    indexes: createEntrySnapshotIndexes(rows)
  }
}

test('creates snapshot indexes from normalized rows', () => {
  const snapshot = createSnapshot()

  test.equal(snapshot.indexes.byId.child, ['child:published', 'child:draft'])
  test.equal(snapshot.indexes.byType.Page, [
    'home:published',
    'child:published',
    'child:draft'
  ])
  test.equal(snapshot.indexes.byParent[indexValue(null)], [
    'home:published',
    'asset:published'
  ])
  test.equal(snapshot.indexes.byParent.home, ['child:published', 'child:draft'])
  test.is(snapshot.indexes.byDir['pages/home/child'], 'child')
  test.is(
    snapshot.indexes.byFilePath['pages/home/child.draft.json'],
    'child:draft'
  )
})

test('plans candidates by intersecting indexed constraints', () => {
  const planner = new SnapshotEntryPlanner(createSnapshot())
  const plan = planner.candidates({
    query: {},
    constraints: {
      type: 'Page',
      parentId: 'home',
      status: 'published'
    }
  })

  test.equal(plan.rowIds, ['child:published'])
})

test('plans candidates for missing index values as empty result', () => {
  const planner = new SnapshotEntryPlanner(createSnapshot())
  const plan = planner.candidates({
    query: {},
    constraints: {id: 'missing'}
  })

  test.equal(plan.rowIds, [])
})

test('plans candidates with trace dependencies', () => {
  const planner = new SnapshotEntryPlanner(createSnapshot())
  const plan = planner.candidates(
    {
      query: {},
      constraints: {
        locale: null,
        filePath: 'pages/home/child.draft.json',
        search: 'child'
      },
      preFilter: {
        indexKeys: ['custom:index']
      }
    },
    {trace: true}
  )

  test.equal(plan.rowIds, ['child:draft'])
  test.ok(plan.trace)
  test.ok(plan.trace!.indexes.has(indexKey('locale', null)))
  test.ok(
    plan.trace!.indexes.has(
      indexKey('filePath', 'pages/home/child.draft.json')
    )
  )
  test.ok(plan.trace!.indexes.has(indexKey('search', 'child')))
  test.ok(plan.trace!.indexes.has('custom:index'))
  test.ok(plan.trace!.rows.has('child:draft'))
})

test('plans unconstrained queries as broad reads', () => {
  const planner = new SnapshotEntryPlanner(createSnapshot())
  const plan = planner.candidates({query: {}}, {trace: true})

  test.equal(plan.rowIds, [
    'home:published',
    'child:published',
    'child:draft',
    'asset:published'
  ])
  test.ok(plan.trace!.indexes.has('all'))
})

test('normalizes null index values', () => {
  test.is(indexValue(null), NULL_INDEX_VALUE)
  test.is(indexKey('parent', null), `parent:${NULL_INDEX_VALUE}`)
})
