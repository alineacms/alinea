import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {Field as CoreField} from '#/core/Field.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {transaction} from '#/core/source/Source.js'
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
