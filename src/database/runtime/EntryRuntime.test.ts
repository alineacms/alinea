import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import type {IndexedEntry} from '../entry/Schema.js'
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
    filePath: `pages/${id}.json`,
    fileHash: `${id}-file`,
    parentDir: 'pages',
    childrenDir: `pages/${id}`,
    url: `/${id}`,
    active: true,
    main: true,
    seeded: null,
    rowHash: title,
    searchableText: '',
    data
  }
  return {entry}
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
    replaceEntryIds: ['a', 'b']
  })
  expect(await runtime.getRevision()).toBe('two')
  expect(await runtime.resolve({select: Entry})).toEqual([
    expect.objectContaining({id: 'a', title: 'Updated', data: {body: 'two'}})
  ])
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
  const entries = Array.from(index.filter({}), entry => ({
    entry: {...entry, versionStatus: entry.status}
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
