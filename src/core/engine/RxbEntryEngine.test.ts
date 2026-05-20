import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {createConfig} from '../Config.js'
import {Entry} from '../Entry.js'
import {
  decodeRxbEntryArtifact,
  encodeRxbEntryArtifact,
  createRxbEntryColumns,
  createRxbEntryData,
  indexKey,
  openRxbEntryEngine,
  rxbEntryIsActive,
  rxbEntryIsMain,
  rxbEntryStatusFromFlags,
  RxbEntryEngine,
  RxbEntryPlanner,
  serializeQueryTrace,
  type RxbEntryArtifact,
  type RxbEntryIndexes,
  type RxbEntryRow
} from './index.js'

const test = suite(import.meta)

const QueryArticle = Config.document('QueryArticle', {
  fields: {
    title: Field.text('Title')
  }
})

const config = createConfig({
  schema: {QueryArticle},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {contains: ['QueryArticle']})
      }
    })
  }
})

function row(
  rowId: string,
  input: Partial<RxbEntryRow> = {}
): RxbEntryRow {
  const id = input.id ?? rowId.replace(':published', '')
  const title = input.title ?? id
  return {
    rowId,
    versionId: `${rowId}:version`,
    nodeId: input.nodeId ?? id,
    languageId: input.languageId ?? `${id}:null`,
    id,
    type: input.type ?? 'QueryArticle',
    index: input.index ?? 'a1',
    title,
    searchableText: input.searchableText ?? title,
    seeded: input.seeded ?? null,
    rowHash: input.rowHash ?? `${rowId}:row`,
    fileHash: input.fileHash ?? `${rowId}:file`,
    data: input.data ?? {title},
    status: input.status ?? 'published',
    locale: input.locale ?? null,
    workspace: input.workspace ?? 'main',
    root: input.root ?? 'pages',
    path: input.path ?? id,
    parentDir: input.parentDir ?? 'pages',
    childrenDir: input.childrenDir ?? `pages/${id}`,
    filePath: input.filePath ?? `pages/${id}.json`,
    level: input.level ?? 0,
    parentId: input.parentId ?? null,
    parents: input.parents ?? [],
    url: input.url ?? `/${input.path ?? id}`,
    active: input.active ?? true,
    main: input.main ?? true,
    versionStatus: input.versionStatus ?? input.status ?? 'published'
  }
}

function createRows(): Array<RxbEntryRow> {
  return [
    row('alpha:published', {
      id: 'alpha',
      title: 'Alpha',
      index: 'a1',
      data: {
        title: 'Alpha',
        score: 10,
        featured: true,
        body: 'red body',
        meta: {inner: 'x'},
        tags: [{itemId: 'one'}, {itemId: 'two'}]
      }
    }),
    row('beta:published', {
      id: 'beta',
      title: 'Beta',
      index: 'a2',
      data: {
        title: 'Beta',
        score: 20,
        featured: false,
        body: 'blue body',
        meta: {inner: 'y'},
        tags: [{itemId: 'two'}]
      }
    }),
    row('gamma:published', {
      id: 'gamma',
      title: 'Gamma',
      index: 'a3',
      data: {
        title: 'Gamma',
        score: 30,
        featured: true,
        body: 'green body',
        meta: {inner: 'x'},
        tags: [{itemId: 'three'}]
      }
    })
  ]
}

function createArtifact(rows = createRows()): RxbEntryArtifact {
  return {
    meta: {
      kind: 'alinea.entry-engine.rxb',
      version: 1,
      configHash: 'config-hash',
      graphSha: 'graph-sha',
      contentHash: 'content-hash',
      createdAt: '2026-05-20T00:00:00.000Z'
    },
    payload: {
      manifest: {version: 1},
      tree: {sha: 'tree-sha', tree: []},
      data: createRxbEntryData(rows),
      columns: createRxbEntryColumns(rows),
      indexes: createIndexes(rows),
      fieldIndexes: {
        exact: {
          featured: {
            true: [0, 2],
            false: [1]
          },
          'meta.inner': {
            x: [0, 2],
            y: [1]
          },
          'tags.itemId': {
            one: [0],
            two: [0, 1],
            three: [2]
          }
        },
        number: {
          score: [
            [10, 0],
            [20, 1],
            [30, 2]
          ]
        }
      }
    }
  }
}

function createIndexes(rows: Array<RxbEntryRow>): RxbEntryIndexes {
  const indexes: RxbEntryIndexes = {
    byId: {},
    byType: {}
  }
  rows.forEach((row, ordinal) => {
    add(indexes.byId, row.id, ordinal)
    add(indexes.byType, row.type, ordinal)
  })
  return indexes
}

function add(
  target: Record<string, Array<number>>,
  key: string,
  value: number
) {
  const values = target[key] ?? []
  values.push(value)
  target[key] = values
}

test('RXB artifact opens metadata and stores compact ordinal index leaves', () => {
  const artifact = createArtifact()
  test.is(artifact.payload.indexes.byId.alpha[0], 0)
  test.is(artifact.payload.indexes.byType.QueryArticle[0], 0)
  test.is(artifact.payload.fieldIndexes.exact['meta.inner'].x[0], 0)

  const opened = decodeRxbEntryArtifact(encodeRxbEntryArtifact(artifact))

  test.is(opened.meta.configHash, 'config-hash')
  test.is(opened.meta.contentHash, 'content-hash')
  test.is(opened.meta.graphSha, 'graph-sha')

  test.is(opened.payload.indexes.byId.alpha[0], 0)
  test.is(opened.payload.indexes.byType.QueryArticle[0], 0)
  test.is(opened.payload.fieldIndexes.exact['meta.inner'].x[0], 0)
  test.is(opened.payload.fieldIndexes.exact['tags.itemId'].two[0], 0)
  test.is(opened.payload.fieldIndexes.number.score[0][1], 0)
})

test('RXB artifact packs active, main, and status into row flags', () => {
  const artifact = createArtifact([
    row('alpha:published', {id: 'alpha'}),
    row('beta:draft', {
      id: 'beta',
      status: 'draft',
      active: false,
      main: false
    }),
    row('gamma:archived', {id: 'gamma', status: 'archived'})
  ])

  test.equal(Object.keys(artifact.payload.indexes).sort(), [
    'byId',
    'byType'
  ])
  test.equal(artifact.payload.columns.flags.length, 3)
  test.is(rxbEntryStatusFromFlags(artifact.payload.columns.flags[0]), 'published')
  test.is(rxbEntryStatusFromFlags(artifact.payload.columns.flags[1]), 'draft')
  test.is(rxbEntryStatusFromFlags(artifact.payload.columns.flags[2]), 'archived')
  test.is(rxbEntryIsActive(artifact.payload.columns.flags[0]), true)
  test.is(rxbEntryIsMain(artifact.payload.columns.flags[0]), true)
  test.is(rxbEntryIsActive(artifact.payload.columns.flags[1]), false)
  test.is(rxbEntryIsMain(artifact.payload.columns.flags[1]), false)
})

test('RXB artifact rejects unsupported versions', async () => {
  const artifact = createArtifact()
  await test.throws(
    () =>
      decodeRxbEntryArtifact(
        encodeRxbEntryArtifact({
          ...artifact,
          meta: {...artifact.meta, version: 2 as any}
        })
      ),
    'unsupported version 2'
  )
})

test('RXB planner uses exact, nested, list, and numeric field indexes', () => {
  const planner = new RxbEntryPlanner(config, createArtifact())

  test.equal(
    planner.candidateRows({
      query: {
        filter: {_type: {in: ['QueryArticle']}, _active: true}
      } as any
    }).rowIds,
    ['alpha:published', 'beta:published', 'gamma:published']
  )

  test.equal(
    planner.candidateRows({
      query: {
        filter: {
          and: [
            {featured: true},
            {meta: {has: {inner: {is: 'x'}}}},
            {tags: {includes: {itemId: {is: 'two'}}}}
          ]
        }
      } as any,
      constraints: {type: 'QueryArticle'}
    }).rowIds,
    ['alpha:published']
  )

  test.equal(
    planner.candidateRows({
      query: {
        filter: {
          score: {gte: 20, lte: 30}
        }
      } as any
    }).rowIds,
    ['beta:published', 'gamma:published']
  )
})

test('RXB planner lazily indexes queried entry fields', () => {
  const rows = createRows().map(input =>
    row(`pages/${input.id}.json`, {
      ...input,
      id: input.id,
      filePath: `pages/${input.id}.json`
    })
  )
  const planner = new RxbEntryPlanner(config, createArtifact(rows), {
    leafCacheSize: 2
  })
  const query = {
    query: {
      filter: {_workspace: 'main', _root: 'pages', _parentId: null}
    } as any,
    constraints: {type: 'QueryArticle'}
  }

  const result = planner.candidateRows(query, {trace: true})

  test.equal(result.rowIds, [
    'pages/alpha.json',
    'pages/beta.json',
    'pages/gamma.json'
  ])
  test.ok(result.trace!.indexes.has('field:_workspace:main'))
  test.ok(result.trace!.indexes.has('field:_root:pages'))
  test.ok(result.trace!.indexes.has('field:_parentId:<null>'))
})

test('RXB planner traces cached and uncached field leaves identically', () => {
  const planner = new RxbEntryPlanner(config, createArtifact(), {leafCacheSize: 2})
  const query = {
    query: {
      filter: {
        and: [{featured: true}, {meta: {has: {inner: {is: 'x'}}}}]
      }
    } as any,
    constraints: {type: 'QueryArticle'}
  }

  const first = planner.candidateRows(query, {trace: true})
  const second = planner.candidateRows(query, {trace: true})

  test.equal(
    serializeQueryTrace(first.trace!),
    serializeQueryTrace(second.trace!)
  )
  test.ok(first.trace!.indexes.has(indexKey('type', 'QueryArticle')))
  test.ok(first.trace!.indexes.has('field:featured:true'))
  test.ok(first.trace!.indexes.has('field:meta.inner:x'))
  test.ok(first.trace!.rows.has('alpha:published'))
  test.ok(first.trace!.rows.has('gamma:published'))
})

test('RXB engine queries indexed filters and materializes only final entries', async () => {
  const engine = openRxbEntryEngine(config, encodeRxbEntryArtifact(createArtifact()))

  test.equal(
    await engine.query({
      query: {
        type: 'QueryArticle',
        filter: {score: {gte: 20, lte: 30}},
        orderBy: {asc: Entry.title},
        select: Entry.id
      } as any
    }),
    ['beta', 'gamma']
  )

  test.is(
    await engine.query({
      query: {
        type: 'QueryArticle',
        filter: {score: {gte: 10, notIn: [10]}},
        count: true
      } as any
    }),
    2
  )
})

test('RXB engine projects selected entry fields directly from rows', async () => {
  const engine = openRxbEntryEngine(config, encodeRxbEntryArtifact(createArtifact()))

  test.equal(
    await engine.query({
      query: {
        type: 'QueryArticle',
        filter: {featured: true},
        orderBy: {desc: Entry.title},
        select: {
          id: Entry.id,
          nested: {
            url: Entry.url,
            status: Entry.status
          }
        }
      } as any
    }),
    [
      {id: 'gamma', nested: {url: '/gamma', status: 'published'}},
      {id: 'alpha', nested: {url: '/alpha', status: 'published'}}
    ]
  )
})

test('RXB engine applies row-id ordering windows before projection', async () => {
  const engine = openRxbEntryEngine(config, encodeRxbEntryArtifact(createArtifact()))

  test.equal(
    await engine.query({
      query: {
        orderBy: {desc: Entry.id},
        skip: 1,
        take: 1,
        select: Entry.id
      } as any
    }),
    ['beta']
  )
})

test('RXB engine searches with a lazy in-memory search index', async () => {
  const engine = openRxbEntryEngine(config, encodeRxbEntryArtifact(createArtifact()))

  test.equal(
    await engine.query({
      query: {
        type: 'QueryArticle',
        search: 'alp',
        select: Entry.id
      } as any
    }),
    ['alpha']
  )
})

test('RXB engine falls back to post-filtering unsupported filter parts', async () => {
  const engine = new RxbEntryEngine({config, artifact: createArtifact()})
  const result = await engine.query<Array<string>>(
    {
      query: {
        type: 'QueryArticle',
        filter: {title: {startsWith: 'Al'}},
        select: Entry.id
      } as any
    },
    {trace: true}
  )

  test.equal(result.value, ['alpha'])
  test.ok(result.trace.indexes.has(indexKey('type', 'QueryArticle')))
  test.ok(result.trace.rows.has('alpha:published'))
  test.ok(result.trace.rows.has('beta:published'))
  test.ok(result.trace.rows.has('gamma:published'))
})
