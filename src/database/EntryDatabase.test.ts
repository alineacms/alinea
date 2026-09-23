import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {ListRow} from '#/core/ListRow.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {transaction} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {isRecord} from '#/core/util/Objects.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntryStore} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {sql, type Database as RadoDatabase} from 'rado'
import {connect} from 'rado/driver/bun-sqlite'
import {createGeneratedDatabase} from '#/backend/store/GeneratedDatabase.js'
import {openWasmDatabase} from './driver/WasmDatabase.js'
import {EntryDatabase} from './EntryDatabase.js'
import {entryDataText, supportsJsonb} from './entry/EntryData.js'
import {EntryIndexTable} from './entry/EntryTable.js'

function urlAlias(url: string) {
  return {
    [ListRow.id]: `alias-${url}`,
    [ListRow.index]: 'a0',
    [ListRow.type]: 'alias',
    url
  }
}

function aliasUrls(value: unknown): Array<string> {
  if (!Array.isArray(value)) return []
  return value.flatMap(value => {
    if (!isRecord(value)) return []
    return typeof value.url === 'string' ? [value.url] : []
  })
}

test('SQL entry-link queries retain the Graph API behavior', async () => {
  const Page = ConfigBuilder.document('Page', {
    fields: {
      single: Field.entry('Single'),
      many: Field.entry.multiple('Many')
    }
  })
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const {source, store} = await createEntryStore(config, [
    {
      id: 'source',
      type: 'Page',
      index: 'a',
      data: {
        single: {_type: 'entry', _id: 'single', _entry: 'a'},
        many: ['b', 'a', 'b', 'missing'].map((_entry, index) => ({
          _type: 'entry',
          _id: String(index),
          _entry
        }))
      }
    },
    {id: 'a', type: 'Page', index: 'b'},
    {id: 'b', type: 'Page', index: 'c'}
  ])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const runtime = new EntryDatabase(config, db)
  await runtime.syncWith(source)
  for (const select of [
    Page.single,
    Page.many,
    Page.single.first({select: Entry.id}),
    Page.many.find({select: Entry.id}),
    Page.many.find({count: true})
  ]) {
    const query = {id: 'source', select}
    expect(await runtime.resolve(query)).toEqual(await store.resolve(query))
  }
})

test('SQL references retain status and locale behavior', async () => {
  const Page = ConfigBuilder.document('Page', {
    fields: {related: Field.entry('Related')}
  })
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const link = (entry: string, id: string) => ({
    _type: 'entry',
    _entry: entry,
    _id: id
  })
  const {source, store} = await createEntryStore(config, [
    {id: 'target', type: 'Page', index: 'a'},
    {
      id: 'source',
      type: 'Page',
      index: 'b',
      status: 'published',
      data: {related: link('target', 'published-link')}
    },
    {
      id: 'source',
      type: 'Page',
      index: 'b',
      status: 'draft',
      data: {related: link('other', 'draft-link')}
    }
  ])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const runtime = new EntryDatabase(config, db)
  await runtime.syncWith(source)

  for (const query of [
    {targetId: 'target' as const},
    {targetId: 'target' as const, status: 'preferDraft' as const},
    {targetId: 'other' as const, status: 'preferDraft' as const},
    {targetId: 'target' as const, locale: 'en'}
  ]) {
    const expected = await store.referencesTo(query)
    const actual = await runtime.referencesTo(query)
    expect(actual.total).toBe(expected.total)
    expect(actual.references).toEqual(expected.references)
  }
})

test('entry database returns source blobs by hash', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const {source} = await createEntryStore(config, [
    {id: 'page', type: 'Page', index: 'a', data: {title: 'Page'}}
  ])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const runtime = new EntryDatabase(config, db)
  await runtime.syncWith(source)
  const tree = await source.getTree()
  const shas = [...tree.index().values()]
  const expected = new Map<string, Uint8Array>()
  const actual = new Map<string, unknown>()
  for await (const blob of source.getBlobs(shas)) expected.set(...blob)
  // Data is served as minified JSON.
  for await (const [sha, blob] of runtime.getBlobs(shas))
    actual.set(sha, JSON.parse(new TextDecoder().decode(blob)))
  expect(actual).toEqual(
    new Map(
      [...expected].map(([sha, blob]) => [
        sha,
        JSON.parse(new TextDecoder().decode(blob))
      ])
    )
  )
  expect(await runtime.getTree()).toEqual(tree)
  const stored = await db
    .select({
      data: entryDataText(EntryIndexTable),
      payload: EntryIndexTable.payload
    })
    .from(EntryIndexTable)
    .get()
  expect(stored?.payload).toBeNull()
  expect(JSON.parse(stored!.data)).toEqual(
    JSON.parse(new TextDecoder().decode(expected.values().next().value!))
  )
  expect(await runtime.get({id: 'page', select: Entry.data})).toEqual({
    path: 'page',
    title: 'Page'
  })
})

test('cached trees follow revisions written by another database instance', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const {source, store} = await createEntryStore(
    {
      schema: {Page},
      workspaces: {
        main: ConfigBuilder.workspace('Main', {
          source: 'content',
          roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
        })
      }
    },
    [{id: 'page', type: 'Page', index: 'a', data: {title: 'Page'}}]
  )
  await store.close()
  const directory = await mkdtemp(join(tmpdir(), 'alinea-tree-cache-'))
  try {
    using writeSqlite = new Database(join(directory, 'entries.sqlite'), {
      create: true
    })
    using readSqlite = new Database(join(directory, 'entries.sqlite'))
    const db = connect(writeSqlite)
    await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
    const writer = new EntryDatabase(store.config, db)
    const reader = new EntryDatabase(store.config, connect(readSqlite))
    await writer.syncWith(source)
    const before = await reader.getTree()
    expect(await reader.getTree()).toBe(before)
    const edit = await transaction(source)
    const compiled = await edit.remove('pages/page.json').compile()
    await source.applyChanges({
      fromSha: compiled.from.sha,
      changes: compiled.changes
    })
    await writer.syncWith(source)
    expect((await reader.getTree()).sha).toBe((await source.getTree()).sha)
    expect(await reader.getTree()).not.toBe(before)
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('generated database overlays copy their parent when they first sync', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const encode = (id: string, index: string, title: string) =>
    new TextEncoder().encode(
      JSON.stringify({_id: id, _type: 'Page', _index: index, title})
    )
  async function source(entries: Array<[string, string, string]>) {
    const result = new MemorySource()
    const change = await transaction(result)
    for (const [id, index, title] of entries)
      change.add(`pages/${id}.json`, encode(id, index, title))
    const compiled = await change.compile()
    await result.applyChanges({
      fromSha: compiled.from.sha,
      changes: compiled.changes
    })
    return result
  }

  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, 'empty')
  const base = new EntryDatabase(config, db)
  await base.syncWith(
    await source([
      ['a', 'a', 'Base A'],
      ['b', 'b', 'Base B'],
      ['c', 'c', 'GitHub C']
    ])
  )
  const github = await base.overlay(
    await source([
      ['a', 'a', 'GitHub A'],
      ['c', 'c', 'GitHub C']
    ])
  )
  const baseTree = await base.getTree()
  const githubTree = await github.getTree()
  const requested = [
    ...baseTree.index().values(),
    ...githubTree.index().values()
  ]
  const blobs = new Map<string, Uint8Array>()
  for await (const [sha, blob] of github.getBlobs(requested)) {
    expect(blobs.has(sha)).toBe(false)
    blobs.set(sha, blob)
  }
  expect([...blobs.keys()].sort()).toEqual(
    [...githubTree.index().values()].sort()
  )
  expect(
    [...blobs.values()].map(blob => new TextDecoder().decode(blob)).sort()
  ).toEqual(
    [
      new TextDecoder().decode(encode('a', 'a', 'GitHub A')),
      new TextDecoder().decode(encode('c', 'c', 'GitHub C'))
    ].sort()
  )
  const preview = await github.overlay(
    await source([
      ['a', 'a', 'Preview A'],
      ['b', 'b', 'Preview B'],
      ['c', 'c', 'GitHub C']
    ])
  )

  expect(await base.resolve({select: Entry.title})).toEqual([
    'Base A',
    'Base B',
    'GitHub C'
  ])
  expect(await github.resolve({select: Entry.title})).toEqual([
    'GitHub A',
    'GitHub C'
  ])
  expect(await preview.resolve({select: Entry.title})).toEqual([
    'Preview A',
    'Preview B',
    'GitHub C'
  ])
  expect(
    await preview.resolve({search: 'Preview', select: Entry.title})
  ).toEqual(['Preview A', 'Preview B'])
  await expect(github.close()).rejects.toThrow('active overlays')
  await preview.close()
  await github.close()
  const replacement = await base.overlay(
    await source([['a', 'a', 'Replacement A']])
  )
  expect(await replacement.resolve({select: Entry.title})).toEqual([
    'Replacement A'
  ])
  await replacement.close()
})

test('an unchanged overlay reuses the prepared base search index', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const {source} = await createEntryStore(config, [
    {id: 'page', type: 'Page', index: 'a', data: {title: 'Searchable'}}
  ])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const base = new EntryDatabase(config, db)
  await base.syncWith(source)
  await base.prepareSearch()
  const overlay = await base.overlay(source)

  expect(await overlay.find({search: 'Searchable', select: Entry.id})).toEqual([
    'page'
  ])
  const temporarySearch = await db.get<{name: string}>(sql`
    select name from sqlite_temp_master
    where type = 'table' and name = 'alinea_overlay_1_search'
  `)
  expect(temporarySearch).toBeNull()
  await overlay.close()
  await base.close()
})

test('database mutations use one write transaction and commit one final tree', async () => {
  const Page = ConfigBuilder.document('Page', {
    fields: {title: Field.text('Title')}
  })
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const source = new MemorySource()
  const initial = await source.getTree()
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, initial.sha)
  const database = new EntryDatabase(config, db)

  const result = await database.apply(
    [
      {
        op: 'create',
        id: 'a',
        type: 'Page',
        locale: null,
        data: {title: 'First'}
      },
      {
        op: 'update',
        id: 'a',
        locale: null,
        status: 'published',
        set: {title: 'Updated'}
      }
    ],
    {source}
  )

  expect(await database.resolve({select: Entry.title})).toEqual(['Updated'])
  expect(await source.getTree()).toEqual(initial)
  expect(result.revision).toBe(result.request.intoSha)
  expect(result.changedEntryIds).toEqual(['a'])
  expect(result.request.changes).toHaveLength(1)
  await source.applyChanges(sourceChanges(result.request))
  await database.close()
})

test('failed database mutation batches leave the receiver untouched', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const source = new MemorySource()
  const initial = await source.getTree()
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, initial.sha)
  const database = new EntryDatabase(config, db)

  await expect(
    database.apply(
      [
        {
          op: 'create',
          id: 'a',
          type: 'Page',
          locale: null,
          data: {title: 'First'}
        },
        {
          op: 'create',
          id: 'a',
          type: 'Page',
          locale: null,
          data: {title: 'Duplicate'}
        }
      ],
      {source}
    )
  ).rejects.toThrow('duplicate entry')
  expect(await database.resolve({select: Entry.id})).toEqual([])
  expect(await database.getRevision()).toBe(initial.sha)
  await database.close()
})

test('database mutations preserve authored status and hierarchy transitions', async () => {
  const Page = ConfigBuilder.document('Page', {
    contains: ['Page'],
    fields: {title: Field.text('Title')}
  })
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const source = new MemorySource()
  const initial = await source.getTree()
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, initial.sha)
  const database = new EntryDatabase(config, db)
  async function apply(mutations: Parameters<EntryDatabase['apply']>[0]) {
    const result = await database.apply(mutations, {source})
    await source.applyChanges(sourceChanges(result.request))
    return result
  }

  await apply([
    {
      op: 'create',
      id: 'parent',
      type: 'Page',
      locale: null,
      data: {title: 'Parent'}
    },
    {
      op: 'create',
      id: 'child',
      type: 'Page',
      locale: null,
      data: {title: 'Child'}
    }
  ])
  await apply([
    {
      op: 'move',
      id: 'child',
      target: 'parent',
      targetType: 'entry',
      dropPosition: 'on'
    }
  ])
  expect(
    await database.resolve({
      id: 'child',
      get: true,
      select: {parentId: Entry.parentId, filePath: Entry.filePath}
    })
  ).toEqual({parentId: 'parent', filePath: 'pages/parent/child.json'})

  await apply([{op: 'unpublish', id: 'child', locale: null}])
  expect(
    await database.resolve({
      id: 'child',
      get: true,
      status: 'draft',
      select: {
        status: Entry.status,
        versionStatus: Entry.versionStatus,
        filePath: Entry.filePath
      }
    })
  ).toEqual({
    status: 'draft',
    versionStatus: 'draft',
    filePath: 'pages/parent/child.draft.json'
  })

  await apply([
    {op: 'publish', id: 'child', locale: null, status: 'draft'},
    {op: 'archive', id: 'child', locale: null}
  ])
  expect(
    await database.resolve({
      id: 'child',
      get: true,
      status: 'archived',
      select: {
        status: Entry.status,
        versionStatus: Entry.versionStatus,
        filePath: Entry.filePath
      }
    })
  ).toEqual({
    status: 'archived',
    versionStatus: 'archived',
    filePath: 'pages/parent/child.archived.json'
  })

  await apply([{op: 'remove', id: 'child'}])
  expect(await database.resolve({id: 'child', select: Entry.id})).toEqual([])
  await database.close()
})

test('database mutations commit to the receiving overlay only', async () => {
  const Page = ConfigBuilder.document('Page', {
    fields: {title: Field.text('Title')}
  })
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  async function source(title: string) {
    const result = new MemorySource()
    const change = await transaction(result)
    const compiled = await change
      .add(
        'pages/a.json',
        new TextEncoder().encode(
          JSON.stringify({_id: 'a', _type: 'Page', _index: 'a', title})
        )
      )
      .compile()
    await result.applyChanges({
      fromSha: compiled.from.sha,
      changes: compiled.changes
    })
    return result
  }

  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, 'empty')
  const base = new EntryDatabase(config, db)
  await base.syncWith(await source('Base'))
  const remote = await source('Remote')
  const overlay = await base.overlay(remote)
  const remoteRevision = (await remote.getTree()).sha

  const result = await overlay.apply(
    [
      {
        op: 'update',
        id: 'a',
        locale: null,
        status: 'published',
        set: {title: 'Preview'}
      }
    ],
    {source: remote}
  )

  expect(await base.resolve({select: Entry.title})).toEqual(['Base'])
  expect(await overlay.resolve({select: Entry.title})).toEqual(['Preview'])
  expect((await remote.getTree()).sha).toBe(remoteRevision)
  expect(result.request.fromSha).toBe(remoteRevision)
  await overlay.close()
  await base.close()
})

test('database mutations enforce URL ownership and retain previous URLs', async () => {
  const Page = ConfigBuilder.document('Page', {
    contains: ['Page'],
    fields: {}
  })
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const source = new MemorySource()
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, (await source.getTree()).sha)
  const database = new EntryDatabase(config, db)
  async function apply(mutations: Parameters<EntryDatabase['apply']>[0]) {
    const result = await database.apply(mutations, {source})
    await source.applyChanges(sourceChanges(result.request))
  }

  await apply([
    {
      op: 'create',
      id: 'one',
      type: 'Page',
      locale: null,
      data: {
        title: 'One',
        path: 'one',
        metadata: {aliases: [urlAlias('/old-one')]}
      }
    }
  ])
  await apply([
    {
      op: 'create',
      id: 'two',
      type: 'Page',
      locale: null,
      data: {
        title: 'Two',
        path: 'two',
        metadata: {aliases: [urlAlias('/one')]}
      }
    }
  ])
  const owner = await database.first({
    url: '/one',
    select: Entry.id
  })
  expect(owner).toBe('one')
  await apply([
    {
      op: 'update',
      id: 'one',
      locale: null,
      status: 'published',
      set: {path: 'renamed'}
    }
  ])
  expect(
    await database.get({
      id: 'one',
      select: {url: Entry.url, aliases: Entry.aliases}
    })
  ).toMatchObject({url: '/renamed', aliases: expect.any(Array)})
  expect(
    aliasUrls(await database.get({id: 'one', select: Entry.aliases}))
  ).toEqual(['/old-one', '/one'])
  await database.close()
})

test('database moves retain published URLs for an entire subtree', async () => {
  const Page = ConfigBuilder.document('Page', {
    contains: ['Page'],
    fields: {}
  })
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const source = new MemorySource()
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, (await source.getTree()).sha)
  const database = new EntryDatabase(config, db)
  async function apply(mutations: Parameters<EntryDatabase['apply']>[0]) {
    const result = await database.apply(mutations, {source})
    await source.applyChanges(sourceChanges(result.request))
  }
  const data = (title: string, path: string) => ({
    title,
    path,
    metadata: {aliases: []}
  })
  await apply([
    {
      op: 'create',
      id: 'parent',
      type: 'Page',
      locale: null,
      data: data('Parent', 'parent')
    },
    {
      op: 'create',
      id: 'target',
      type: 'Page',
      locale: null,
      data: data('Target', 'target')
    },
    {
      op: 'create',
      id: 'child',
      type: 'Page',
      locale: null,
      parentId: 'parent',
      data: data('Child', 'child')
    }
  ])
  await apply([
    {
      op: 'move',
      id: 'parent',
      target: 'target',
      targetType: 'entry',
      dropPosition: 'on'
    }
  ])
  const result = await database.find({
    id: {in: ['parent', 'child']},
    select: {id: Entry.id, url: Entry.url, aliases: Entry.aliases}
  })
  expect(result).toEqual([
    {id: 'parent', url: '/target/parent', aliases: expect.any(Array)},
    {id: 'child', url: '/target/parent/child', aliases: expect.any(Array)}
  ])
  expect(aliasUrls(result[0].aliases)).toEqual(['/parent'])
  expect(aliasUrls(result[1].aliases)).toEqual(['/parent/child'])
  await database.close()
})

test('database mutations propagate shared fields between translations', async () => {
  const Page = ConfigBuilder.document('Page', {
    fields: {shared: Field.text('Shared', {shared: true})}
  })
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {
          pages: ConfigBuilder.root('Pages', {i18n: {locales: ['en', 'de']}})
        }
      })
    }
  }
  const source = new MemorySource()
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, (await source.getTree()).sha)
  const database = new EntryDatabase(config, db)
  async function apply(mutations: Parameters<EntryDatabase['apply']>[0]) {
    const result = await database.apply(mutations, {source})
    await source.applyChanges(sourceChanges(result.request))
  }
  await apply([
    {
      op: 'create',
      id: 'page',
      type: 'Page',
      locale: 'en',
      data: {title: 'English', shared: 'initial'}
    },
    {
      op: 'create',
      id: 'page',
      type: 'Page',
      locale: 'de',
      data: {title: 'German'}
    }
  ])
  expect(
    await database.get({id: 'page', locale: 'de', select: Page.shared})
  ).toBe('initial')
  await apply([
    {
      op: 'update',
      id: 'page',
      locale: 'en',
      status: 'published',
      set: {shared: 'updated'}
    }
  ])
  expect(
    await database.find({id: 'page', select: Page.shared, status: 'published'})
  ).toEqual(['updated', 'updated'])
  await database.close()
})

test('search follows synced changes without rebuilding the index', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const encode = (id: string, title: string) =>
    new TextEncoder().encode(
      JSON.stringify({_id: id, _type: 'Page', _index: id, title})
    )
  const source = new MemorySource()
  const initial = await transaction(source)
  initial.add('pages/a.json', encode('a', 'Alpha'))
  initial.add('pages/b.json', encode('b', 'Beta'))
  const compiled = await initial.compile()
  await source.applyChanges({
    fromSha: compiled.from.sha,
    changes: compiled.changes
  })
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const base = new EntryDatabase(config, db)
  await base.syncWith(source)
  await base.prepareSearch()
  expect(await base.find({search: 'Alpha', select: Entry.id})).toEqual(['a'])

  // Corrupting the index proves later results come from in-place updates
  // rather than a rebuild from the entry table.
  await db.run(
    sql`delete from alinea_entry_search where versionId like '%"b"%'`
  )
  const change = await transaction(source)
  change.add('pages/a.json', encode('a', 'Gamma'))
  change.remove('pages/b.json')
  change.add('pages/c.json', encode('c', 'Delta'))
  const next = await change.compile()
  await source.applyChanges({fromSha: next.from.sha, changes: next.changes})
  await base.syncWith(source)

  expect(await base.find({search: 'Gamma', select: Entry.id})).toEqual(['a'])
  expect(await base.find({search: 'Alpha', select: Entry.id})).toEqual([])
  expect(await base.find({search: 'Beta', select: Entry.id})).toEqual([])
  expect(await base.find({search: 'Delta', select: Entry.id})).toEqual(['c'])
  const rows = await db.all<{versionId: string}>(
    sql`select versionId from alinea_entry_search`
  )
  expect(rows.length).toBe(2)
  const state = await db.get<{revision: string; searchRevision: string}>(
    sql`select revision, searchRevision from alinea_database_state where id = 1`
  )
  expect(state?.searchRevision).toBe(state?.revision)
  await base.close()
})

test('a reopened database trusts the search index it persisted', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const {source} = await createEntryStore(config, [
    {id: 'page', type: 'Page', index: 'a', data: {title: 'Persisted'}}
  ])
  const dir = await mkdtemp(join(tmpdir(), 'alinea-search-'))
  const file = join(dir, 'database.sqlite')
  try {
    const initial = connect(new Database(file))
    await EntryDatabase.createSchema(initial, ReadonlyTree.EMPTY.sha)
    const first = new EntryDatabase(config, initial)
    await first.syncWith(source)
    await first.prepareSearch()
    expect(await first.find({search: 'Persisted', select: Entry.id})).toEqual([
      'page'
    ])
    await first.close()

    const sqlite = new Database(file)
    const db = connect(sqlite)
    // Emptying the persisted index shows whether reopening rebuilds it.
    await db.run(sql`delete from alinea_entry_search`)
    const reopened = new EntryDatabase(config, db)
    expect(
      await reopened.find({search: 'Persisted', select: Entry.id})
    ).toEqual([])
    await reopened.close()
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})

test('JSONB databases are rebuilt or refused where SQLite cannot read them', async () => {
  const Page = ConfigBuilder.document('Page', {fields: {}})
  const config: Config = {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const {source} = await createEntryStore(config, [
    {id: 'page', type: 'Page', index: 'a', data: {title: 'Page'}}
  ])
  const dataType = (db: RadoDatabase) =>
    db
      .select(sql<string>`typeof(${EntryIndexTable.data})`)
      .from(EntryIndexTable)
  // Write JSONB with the WASM build, which always reads it.
  const handle = await openWasmDatabase()
  await EntryDatabase.createSchema(handle.database, ReadonlyTree.EMPTY.sha)
  const written = new EntryDatabase(config, handle.database)
  await written.syncWith(source)
  expect(await dataType(handle.database)).toEqual(['blob'])
  const data = handle.export()
  await written.close()

  const dir = await mkdtemp(join(tmpdir(), 'alinea-jsonb-'))
  const file = join(dir, 'database.sqlite')
  try {
    await writeFile(file, data)
    const native = connect(new Database(file, {readonly: true}))
    const version = await native.get<{version: string}>(
      sql`select sqlite_version() as version`
    )
    // Bun bundles a SQLite that reads JSONB on Linux, not on macOS.
    const readsJsonb = await supportsJsonb(native)
    if (readsJsonb) {
      const generated = await createGeneratedDatabase(config, native)
      expect(await generated.find({select: Entry.title})).toEqual(['Page'])
      await generated.close()
    } else {
      await expect(createGeneratedDatabase(config, native)).rejects.toThrow(
        `Alinea's generated database stores JSONB, which requires SQLite 3.45.0 or newer (found ${version?.version})`
      )
    }

    const db = connect(new Database(file))
    await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
    expect(await dataType(db)).toEqual(readsJsonb ? ['blob'] : [])
    const reopened = new EntryDatabase(config, db)
    await reopened.syncWith(source)
    expect(await reopened.find({select: Entry.title})).toEqual(['Page'])
    expect(await dataType(db)).toEqual([readsJsonb ? 'blob' : 'text'])
    await reopened.close()
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})
