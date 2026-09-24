import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {connect} from 'rado/driver/bun-sqlite'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

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

function pages(titles: Record<string, string>): Promise<MemorySource> {
  return createEntrySource(
    config,
    Object.entries(titles).map(([id, title]) => ({
      id,
      type: 'Page',
      index: id,
      data: {title}
    }))
  )
}

/** Generate a database file the way the CLI does, with a built index. */
async function generate(file: string, source: MemorySource) {
  const db = await runtimeDatabase({path: file})
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const database = new EntryDatabase(config, db)
  await database.syncWith(source)
  await database.compact()
  return database
}

async function withDirectory(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-generated-'))
  try {
    await run(dir)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
}

test('a readonly generated database takes mutations in its overlay', () =>
  withDirectory(async dir => {
    const file = join(dir, 'database.sqlite')
    await (
      await generate(file, await pages({a: 'Base A', b: 'Base B'}))
    ).close()
    const reader = await runtimeDatabase({path: file, readonly: true})
    const store = await createGeneratedDatabase(config, reader)
    try {
      expect(await store.find({search: 'Base', select: Entry.id})).toEqual([
        'a',
        'b'
      ])
      await store.mutate([
        {
          op: 'update',
          id: 'a',
          locale: null,
          status: 'published',
          set: {title: 'Changed A'}
        }
      ])
      expect(await store.find({search: 'Changed', select: Entry.id})).toEqual([
        'a'
      ])
      expect(await store.find({search: 'Base', select: Entry.id})).toEqual([
        'b'
      ])
    } finally {
      await store.close()
    }
  }))

test('overlay mutations leave the shared base search index untouched', () =>
  withDirectory(async dir => {
    const file = join(dir, 'database.sqlite')
    await (await generate(file, await pages({a: 'Base A'}))).close()
    const store = await createGeneratedDatabase(
      config,
      await runtimeDatabase({path: file})
    )
    try {
      await store.mutate([
        {
          op: 'update',
          id: 'a',
          locale: null,
          status: 'published',
          set: {title: 'Changed A'}
        }
      ])
    } finally {
      await store.close()
    }
    const base = new EntryDatabase(config, await runtimeDatabase({path: file}))
    try {
      expect(await base.find({search: 'Changed', select: Entry.id})).toEqual([])
      expect(await base.find({search: 'Base', select: Entry.id})).toEqual(['a'])
    } finally {
      await base.close()
    }
  }))

test('a readonly handler follows a dev server writing the same file', () =>
  withDirectory(async dir => {
    const file = join(dir, 'database.sqlite')
    const devServer = await generate(file, await pages({a: 'Base A'}))
    const reader = await runtimeDatabase({path: file, readonly: true})
    const store = await createGeneratedDatabase(config, reader)
    try {
      // The dev server commits an edit, then the handler syncs to it
      const edited = await pages({a: 'Edited A', b: 'Added B'})
      await devServer.syncWith(edited)
      await store.syncWith(edited)
      expect(await store.find({search: 'Edited', select: Entry.id})).toEqual([
        'a'
      ])
      await store.mutate([
        {
          op: 'update',
          id: 'b',
          locale: null,
          status: 'published',
          set: {title: 'Changed B'}
        }
      ])
      expect(
        await store.find({search: 'Changed', select: Entry.title})
      ).toEqual(['Changed B'])
      expect(await devServer.find({search: 'Added', select: Entry.id})).toEqual(
        ['b']
      )
    } finally {
      await store.close()
      await devServer.close()
    }
  }))

test('a read-only generated database commits after searching', () =>
  withDirectory(async dir => {
    const file = join(dir, 'db.sqlite')
    const sqlite = new Database(file)
    const db = connect(sqlite)
    await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
    const database = new EntryDatabase(config, db)
    const store = new EntryStore(config, database, new MemorySource())
    await store.mutate(
      ['page', 'other'].map(id => ({
        op: 'create' as const,
        id,
        type: 'Page',
        locale: null,
        data: {title: `Title ${id}`}
      }))
    )
    await database.compact()
    await database.close()
    sqlite.close()

    const generated = await createGeneratedDatabase(
      config,
      connect(new Database(file, {readonly: true}))
    )
    try {
      // A search first: writes must never reach the shared, read-only index.
      expect(await generated.find({search: 'title', select: Entry.id})).toEqual(
        ['page', 'other']
      )
      const request = await generated.request([
        {
          op: 'update',
          id: 'page',
          locale: null,
          status: 'published',
          set: {title: 'Changed'}
        }
      ])
      expect(await generated.write(request)).toEqual({sha: request.intoSha})
      expect(
        await generated.find({search: 'changed', select: Entry.id})
      ).toEqual(['page'])
    } finally {
      await generated.close()
    }
  }))
