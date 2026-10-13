import type {Config} from '#/core/Config.js'
import type {EntryReferenceQuery} from '#/core/db/EntryReference.js'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {transaction} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntrySource, createEntryStore} from '#test/EntryFixture.js'
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
import {databaseVersion} from './Version.js'

test('references follow the status and locale of their source', async () => {
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
  const source = await createEntrySource(config, [
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
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  const runtime = new EntryDatabase(config, db)
  await runtime.syncWith(source)
  async function links(query: EntryReferenceQuery) {
    const {references, total} = await runtime.referencesTo(query)
    expect(total).toBe(references.length)
    return references.map(reference => reference.linkId)
  }
  // The target row holds its own id in data but references nothing.
  expect(await links({targetId: 'target'})).toEqual(['published-link'])
  expect(await links({targetId: 'other'})).toEqual([])
  expect(await links({targetId: 'target', status: 'preferDraft'})).toEqual([])
  expect(await links({targetId: 'other', status: 'preferDraft'})).toEqual([
    'draft-link'
  ])
  expect(await links({targetId: 'target', locale: 'en'})).toEqual([])
})

test('indexed references follow updates, deletions and reindexes', async () => {
  function pages(linked: boolean): Config {
    // Stored as text, the same data references nothing.
    const related = linked ? Field.entry('Related') : Field.text('Related')
    const fields = {related}
    return {
      schema: {Page: ConfigBuilder.document('Page', {fields})},
      workspaces: {
        main: ConfigBuilder.workspace('Main', {
          source: 'content',
          roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
        })
      }
    }
  }
  const linked = pages(true)
  const plain = pages(false)
  const encode = (id: string, target?: string) =>
    new TextEncoder().encode(
      JSON.stringify({
        _id: id,
        _type: 'Page',
        _index: id,
        title: id,
        related: target && {_type: 'entry', _id: `link-${id}`, _entry: target}
      })
    )
  const source = new MemorySource()
  const initial = await transaction(source)
  initial.add('pages/a.json', encode('a', 'target'))
  initial.add('pages/b.json', encode('b', 'target'))
  initial.add('pages/target.json', encode('target'))
  const compiled = await initial.compile()
  await source.applyChanges({
    fromSha: compiled.from.sha,
    changes: compiled.changes
  })
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, linked, ReadonlyTree.EMPTY.sha)
  const runtime = new EntryDatabase(linked, db)
  await runtime.syncWith(source)
  async function sources(targetId: string) {
    const {references} = await runtime.referencesTo({targetId})
    return references.map(reference => reference.sourceId)
  }
  const indexed = () =>
    db.get(sql`select count(*) as count from alinea_entry_reference`)
  expect(await sources('target')).toEqual(['a', 'b'])

  // One source links elsewhere, the other is deleted.
  const change = await transaction(source)
  change.add('pages/a.json', encode('a', 'other'))
  change.remove('pages/b.json')
  const next = await change.compile()
  await source.applyChanges({fromSha: next.from.sha, changes: next.changes})
  await runtime.syncWith(source)
  expect(await sources('target')).toEqual([])
  expect(await sources('other')).toEqual(['a'])
  expect(await indexed()).toEqual({count: 1})

  // Reindexing derives the references of the config it adopts.
  await runtime.reindex(plain)
  expect(await sources('other')).toEqual([])
  expect(await indexed()).toEqual({count: 0})
  await runtime.reindex(linked)
  expect(await sources('other')).toEqual(['a'])
  expect(await indexed()).toEqual({count: 1})
  await runtime.close()
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
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
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
    await EntryDatabase.createSchema(db, store.config, ReadonlyTree.EMPTY.sha)
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

test('syncing after another instance moved the revision on', async () => {
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
    [
      {id: 'one', type: 'Page', index: 'a', data: {title: 'One'}},
      {id: 'two', type: 'Page', index: 'b', data: {title: 'Two'}}
    ]
  )
  await store.close()
  const directory = await mkdtemp(join(tmpdir(), 'alinea-tree-sync-'))
  const remove = async (file: string) => {
    const edit = await transaction(source)
    const compiled = await edit.remove(file).compile()
    await source.applyChanges({
      fromSha: compiled.from.sha,
      changes: compiled.changes
    })
  }
  try {
    using firstSqlite = new Database(join(directory, 'entries.sqlite'), {
      create: true
    })
    using secondSqlite = new Database(join(directory, 'entries.sqlite'))
    const db = connect(firstSqlite)
    await EntryDatabase.createSchema(db, store.config, ReadonlyTree.EMPTY.sha)
    const first = new EntryDatabase(store.config, db)
    const second = new EntryDatabase(store.config, connect(secondSqlite))
    await second.syncWith(source)
    await remove('pages/one.json')
    await first.syncWith(source)
    // The second instance still caches the first tree
    await remove('pages/two.json')
    const result = await second.syncWith(source)
    expect(result.revision).toBe((await source.getTree()).sha)
    expect(await second.count({})).toBe(0)
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('overlays are independent of their parent and of each other', async () => {
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

  const {database: db, fork} = await openWasmDatabase()
  await EntryDatabase.createSchema(db, config, 'empty')
  const base = new EntryDatabase(config, db, {fork})
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
  expect(await base.resolve({select: Entry.title})).toEqual([
    'Base A',
    'Base B',
    'GitHub C'
  ])
  expect(await github.resolve({select: Entry.title})).toEqual([
    'GitHub A',
    'GitHub C'
  ])
  // Later syncs stay on the side that made them.
  await base.syncWith(await source([['b', 'b', 'Later B']]))
  await github.syncWith(await source([['c', 'c', 'Later C']]))
  expect(await base.resolve({select: Entry.title})).toEqual(['Later B'])
  expect(await github.resolve({select: Entry.title})).toEqual(['Later C'])
  // Either side closes first without affecting the other.
  const replacement = await base.overlay(
    await source([['a', 'a', 'Replacement A']])
  )
  await github.close()
  expect(await base.resolve({select: Entry.title})).toEqual(['Later B'])
  await base.close()
  expect(await replacement.resolve({select: Entry.title})).toEqual([
    'Replacement A'
  ])
  await replacement.close()
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
  await EntryDatabase.createSchema(db, config, initial.sha)
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

/** A database with a media root, applying mutations returns removed files */
async function mediaDatabase() {
  const {config} = createCMS({
    schema: {},
    enableDrafts: true,
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        mediaDir: 'public',
        roots: {media: ConfigBuilder.media()}
      })
    }
  })
  const source = new MemorySource()
  const sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, config, (await source.getTree()).sha)
  const database = new EntryDatabase(config, db)
  return {
    async removedFiles(mutations: Array<Mutation>) {
      const {request} = await database.apply(mutations, {source})
      await source.applyChanges(sourceChanges(request))
      return request.changes.flatMap(change =>
        change.op === 'removeFile' ? [change.location] : []
      )
    },
    /** The stored data of the media file, its draft if there is one */
    file() {
      return database.resolve({
        id: 'file',
        status: 'preferDraft',
        first: true,
        select: Entry.data
      })
    },
    async [Symbol.asyncDispose]() {
      await database.close()
      sqlite.close()
    }
  }
}

const brochure = {
  title: 'Brochure',
  location: '/brochure.pdf',
  extension: '.pdf',
  size: 1024,
  hash: 'hash'
}

test('discarding a media draft keeps the file of the published version', async () => {
  await using media = await mediaDatabase()
  const versions = (status: 'draft' | 'published'): Array<Mutation> => [
    {
      op: 'create',
      id: 'dir',
      type: 'MediaLibrary',
      locale: null,
      status,
      data: {title: 'Dir'}
    },
    {
      op: 'create',
      id: 'file',
      parentId: 'dir',
      type: 'MediaFile',
      locale: null,
      status,
      data: brochure
    }
  ]
  await media.removedFiles(versions('published'))
  await media.removedFiles(versions('draft'))
  expect(
    await media.removedFiles([{op: 'remove', id: 'file', status: 'draft'}])
  ).toEqual([])
  expect(
    await media.removedFiles([{op: 'remove', id: 'dir', status: 'draft'}])
  ).toEqual([])
  expect(await media.removedFiles([{op: 'remove', id: 'file'}])).toEqual([
    'public/brochure.pdf'
  ])
})

test('saving a media file only removes its previous file when replaced', async () => {
  await using media = await mediaDatabase()
  const save = (
    data: Record<string, unknown>,
    status: 'draft' | 'published' = 'published'
  ): Mutation => ({
    op: 'create',
    id: 'file',
    type: 'MediaFile',
    locale: null,
    status,
    data,
    overwrite: true
  })
  const focus = {x: 0.2, y: 0.8}
  await media.removedFiles([save({...brochure, alt: 'Cover', focus})])
  // Replacing uploads the new file and removes the previous one, it keeps
  // what the editor entered
  const upload = {
    title: 'Brochure',
    location: '/brochure-v2.pdf',
    extension: '.pdf',
    size: 2048,
    hash: 'v2'
  }
  expect(
    await media.removedFiles([
      {op: 'uploadFile', url: '', location: 'public/brochure-v2.pdf'},
      save(upload)
    ])
  ).toEqual(['public/brochure.pdf'])
  const current = {...upload, alt: 'Cover', focus}
  expect(await media.file()).toMatchObject(current)
  // An editor still showing the file from before the replace saves a new
  // alt text: the entry keeps pointing at the current file
  const stale = {...brochure, alt: 'Front cover', focus}
  expect(await media.removedFiles([save(stale, 'draft')])).toEqual([])
  expect(await media.file()).toMatchObject({...current, alt: 'Front cover'})
  expect(await media.removedFiles([save(stale)])).toEqual([])
  expect(await media.file()).toMatchObject({...current, alt: 'Front cover'})
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
  await EntryDatabase.createSchema(db, config, initial.sha)
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

test('a reopened database searches the index it persisted', async () => {
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
    await EntryDatabase.createSchema(initial, config, ReadonlyTree.EMPTY.sha)
    const first = new EntryDatabase(config, initial)
    await first.syncWith(source)
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
  await EntryDatabase.createSchema(
    handle.database,
    config,
    ReadonlyTree.EMPTY.sha
  )
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
      const generated = await createGeneratedDatabase(config, {
        database: native
      })
      expect(await generated.find({select: Entry.title})).toEqual(['Page'])
      await generated.close()
    } else {
      await expect(
        createGeneratedDatabase(config, {database: native})
      ).rejects.toThrow(
        `Alinea's generated database stores JSONB, which requires SQLite 3.45.0 or newer (found ${version?.version})`
      )
    }

    const db = connect(new Database(file))
    await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
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

test('databases written with an older layout are rebuilt', async () => {
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
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  await new EntryDatabase(config, db).syncWith(source)
  const entries = () =>
    db.get(sql`select count(*) as count from alinea_entry_index`)
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  expect(await entries()).toEqual({count: 1})
  // Layouts before version 4 did not record their version.
  await db.run(sql`alter table alinea_database_metadata drop column version`)
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  expect(await entries()).toEqual({count: 0})
  expect(
    await db.get(sql`select version from alinea_database_metadata`)
  ).toEqual({version: databaseVersion})
})

test('opening keeps the statistics there are', async () => {
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
  const handle = await openWasmDatabase()
  const db = handle.database
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  const database = new EntryDatabase(config, db)
  await database.syncWith(
    await createEntrySource(
      config,
      Array.from({length: 50}, (_, i) => ({
        id: `page-${i}`,
        type: 'Page',
        index: `a${String(i).padStart(2, '0')}`,
        data: {title: `Page ${i}`}
      }))
    )
  )
  // SQLite can misjudge the size of the entry table by 25 times
  await db.run(sql`update sqlite_stat1 set stat = '1'
    where tbl = 'alinea_entry_index' and idx is null`)
  await db.run(sql`update sqlite_stat1 set stat = '1 1'
    where tbl = 'alinea_entry_index' and idx is not null`)
  await db.run(sql`analyze sqlite_schema`)
  const before = handle.export()
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  expect(Buffer.compare(handle.export(), before)).toBe(0)
})
