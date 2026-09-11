import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {Field as CoreField} from '#/core/Field.js'
import {ListRow} from '#/core/ListRow.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {transaction} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {isRecord} from '#/core/util/Objects.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {connect} from 'rado/driver/bun-sqlite'
import {EntryIndexTable, entryIndexRow} from './entry/Schema.js'
import {EntryDatabase} from './EntryDatabase.js'

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
  const {resolver, index} = await createEntryResolver(config, [
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
  await EntryDatabase.createSchema(db, 'empty')
  const runtime = new EntryDatabase(config, db)
  await db
    .insert(EntryIndexTable)
    .values(
      Array.from(index.filter({}), entry =>
        entryIndexRow({...entry, versionStatus: entry.status})
      )
    )
  for (const select of [
    Page.single,
    Page.many,
    Page.single.first({select: Entry.id}),
    Page.many.find({select: Entry.id}),
    Page.many.find({count: true})
  ]) {
    const query = {id: 'source', select}
    expect(await runtime.resolve(query)).toEqual(await resolver.resolve(query))
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
  const {source, index} = await createEntryResolver(config, [
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
    const expected = await index.referencesTo(query)
    const actual = await runtime.referencesTo(query)
    expect(actual.total).toBe(expected.total)
    expect(actual.references).toEqual(expected.references)
  }
})

test('subscriptions publish the initial value and committed changes', async () => {
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
  const runtime = new EntryDatabase(config, db)
  const values: Array<unknown> = []
  const errors: Array<unknown> = []
  const changed = Promise.withResolvers<void>()
  const unsubscribe = runtime.subscribe(
    {select: Entry.id},
    {
      next(value) {
        values.push(value)
        if (values.length === 2) changed.resolve()
      },
      error(error) {
        errors.push(error)
      }
    }
  )
  const change = await transaction(source)
  const compiled = await change
    .add(
      'pages/a.json',
      new TextEncoder().encode(
        JSON.stringify({_id: 'a', _type: 'Page', _index: 'a', title: 'A'})
      )
    )
    .compile()
  await source.applyChanges({
    fromSha: compiled.from.sha,
    changes: compiled.changes
  })
  await runtime.syncWith(source)
  await changed.promise
  unsubscribe()
  expect(values).toEqual([[], ['a']])
  expect(errors).toEqual([])
})

test('generated database overlays sync and query without copying the base', async () => {
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
      ['b', 'b', 'Base B']
    ])
  )
  const github = await base.overlay(
    await source([
      ['a', 'a', 'GitHub A'],
      ['c', 'c', 'GitHub C']
    ])
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
    'Base B'
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

test('linked queries retain one snapshot while sync commits separately', async () => {
  const projectionStarted = Promise.withResolvers<void>()
  const resumeProjection = Promise.withResolvers<void>()
  const delayedLink = new CoreField({
    options: {label: 'Delayed link'},
    view: 'DelayedLink',
    async queryValue(value: string, loader) {
      projectionStarted.resolve()
      await resumeProjection.promise
      const [title] = await loader.resolveLinks(Entry.title, [value])
      return title
    }
  })
  const Page = ConfigBuilder.document('Page', {
    fields: {delayedLink, title: Field.text('Title')}
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
  const encode = (id: string, index: string, title: string, link?: string) =>
    new TextEncoder().encode(
      JSON.stringify({
        _id: id,
        _type: 'Page',
        _index: index,
        title,
        ...(link ? {delayedLink: link} : {})
      })
    )
  const initial = await transaction(source)
  const initialChange = await initial
    .add('pages/source.json', encode('source', 'a', 'Source', 'target'))
    .add('pages/target.json', encode('target', 'b', 'Before'))
    .compile()
  await source.applyChanges({
    fromSha: initialChange.from.sha,
    changes: initialChange.changes
  })

  const directory = await mkdtemp(join(tmpdir(), 'alinea-entry-database-'))
  const file = join(directory, 'entries.sqlite')
  const readSqlite = new Database(file, {create: true})
  const syncSqlite = new Database(file)
  readSqlite.exec('pragma journal_mode = wal; pragma busy_timeout = 5000;')
  syncSqlite.exec('pragma journal_mode = wal; pragma busy_timeout = 5000;')
  const readDatabase = connect(readSqlite)
  const syncDatabase = connect(syncSqlite)
  await EntryDatabase.createSchema(readDatabase, 'empty')
  const database = new EntryDatabase(config, readDatabase, {syncDatabase})
  try {
    await database.syncWith(source)
    const pendingQuery = database.resolve({
      id: 'source',
      get: true,
      select: Page.delayedLink
    })
    await projectionStarted.promise

    const update = await transaction(source)
    const updateChange = await update
      .add('pages/target.json', encode('target', 'b', 'After'))
      .compile()
    await source.applyChanges({
      fromSha: updateChange.from.sha,
      changes: updateChange.changes
    })
    await database.syncWith(source)
    resumeProjection.resolve()

    expect(await pendingQuery).toBe('Before')
    expect(
      await database.resolve({
        id: 'source',
        get: true,
        select: Page.delayedLink
      })
    ).toBe('After')
  } finally {
    resumeProjection.resolve()
    await database.close()
    await rm(directory, {recursive: true, force: true})
  }
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
  await expect(
    apply([
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
  ).rejects.toThrow('URL "/one" is already defined by entry one')
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
