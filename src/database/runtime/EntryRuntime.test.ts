import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {
  entrySource,
  entryVersionId,
  type IndexedEntry
} from '../entry/Schema.js'
import {EntryRuntime, type EntryReplacement} from './EntryRuntime.js'

const emptyConfig: Config = {schema: {}, workspaces: {}}

function replacement(
  id: string,
  title = id,
  data: Record<string, unknown> = {}
): EntryReplacement {
  const entry: IndexedEntry = {
    id,
    title,
    type: 'Page',
    locale: null,
    versionStatus: 'published',
    status: 'published',
    workspace: 'main',
    root: 'pages',
    parentId: null,
    parents: [],
    level: 0,
    index: id,
    path: id,
    url: `/${id}`,
    active: true,
    main: true,
    seeded: null,
    rowHash: title
  }
  return {entry, data}
}

test('stores complete rows and applies revision-bound deltas atomically', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(emptyConfig, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'one',
    entries: [replacement('a', 'Alpha', {body: 'one'}), replacement('b')]
  })
  expect(await runtime.resolve({select: Entry.data})).toEqual([
    {body: 'one'},
    {}
  ])
  await expect(
    runtime.apply({fromRevision: 'stale', toRevision: 'bad', entries: []})
  ).rejects.toThrow('revision mismatch')
  await runtime.apply({
    fromRevision: 'one',
    toRevision: 'two',
    entries: [replacement('a', 'Updated', {body: 'two'})],
    removedVersionIds: [entryVersionId('b', null, 'published')]
  })
  expect(await runtime.getRevision()).toBe('two')
  expect(await runtime.resolve({select: Entry})).toEqual([
    expect.objectContaining({id: 'a', title: 'Updated', data: {body: 'two'}})
  ])
})

test('tree construction does not read or parse entry payloads', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(emptyConfig, db)
  const row = replacement('a')
  row.entry.childrenSha = 'directory-a'
  row.entry.rowHash = 'row-a'
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'tree-a',
    entries: [row]
  })
  sqlite.exec(`update alinea_entry_index set data = 'invalid json'`)
  expect([...(await runtime.tree()).index().values()]).toEqual(['row-a'])
})

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
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db)
  const entries = Array.from(index.filter({}), (entry, ordinal) => ({
    entry: {...entry, versionStatus: entry.status, ordinal},
    data: entry.data,
    source: entrySource(entry)
  }))
  await runtime.apply({fromRevision: 'empty', toRevision: 'one', entries})
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

test('subscriptions publish the initial value and committed changes', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(emptyConfig, db)
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
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'one',
    entries: [replacement('a')]
  })
  await changed.promise
  unsubscribe()
  expect(values).toEqual([[], ['a']])
  expect(errors).toEqual([])
})
