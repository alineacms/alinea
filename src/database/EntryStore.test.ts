import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {createEntryRow} from '#/core/util/EntryRows.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {EntryDatabase} from './EntryDatabase.js'
import {EntryStore} from './EntryStore.js'

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

function createStore(source = new MemorySource(), storeConfig = config) {
  const sqlite = new Database(':memory:')
  const db = connect(sqlite)
  return EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha).then(() => ({
    sqlite,
    store: new EntryStore(
      storeConfig,
      new EntryDatabase(storeConfig, db),
      source
    )
  }))
}

test('entry store mutates its source and database together', async () => {
  const {sqlite, store} = await createStore()
  try {
    const {sha} = await store.mutate([
      {
        op: 'create',
        id: 'page',
        type: 'Page',
        locale: null,
        data: {title: 'Page'}
      }
    ])
    expect((await store.source.getTree()).sha).toBe(sha)
    expect(await store.sha).toBe(sha)
    expect(await store.find({select: Entry.title})).toEqual(['Page'])
  } finally {
    sqlite.close()
  }
})

test('entry store requests are isolated until written', async () => {
  const {sqlite, store} = await createStore()
  try {
    const before = await store.sha
    const request = await store.request([
      {
        op: 'create',
        id: 'page',
        type: 'Page',
        locale: null,
        data: {title: 'Page'}
      }
    ])
    expect(await store.sha).toBe(before)
    expect(await store.find({select: Entry.id})).toEqual([])

    expect(await store.write(request)).toEqual({sha: request.intoSha})
    expect(await store.find({select: Entry.id})).toEqual(['page'])
  } finally {
    sqlite.close()
  }
})

test('entry store resolves previews through a temporary database overlay', async () => {
  const {sqlite, store} = await createStore()
  try {
    await store.mutate([
      {
        op: 'create',
        id: 'page',
        type: 'Page',
        locale: null,
        data: {title: 'Published'}
      }
    ])
    const entry = await store.get({id: 'page', select: Entry})
    const {rowHash: _rowHash, fileHash: _fileHash, ...base} = entry
    const preview = await createEntryRow(
      config,
      {...base, title: 'Preview', data: {...entry.data, title: 'Preview'}},
      entry.status
    )
    expect(
      await store.get({
        id: 'page',
        select: Entry.title,
        preview: {entry: preview}
      })
    ).toBe('Preview')
    expect(await store.get({id: 'page', select: Entry.title})).toBe('Published')
  } finally {
    sqlite.close()
  }
})

test('entry store materializes configured seeds in every locale', async () => {
  const Seeded = ConfigBuilder.document('Seeded', {fields: {}})
  const seededConfig: Config = {
    schema: {Seeded},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {
          pages: ConfigBuilder.root('Pages', {
            i18n: {locales: ['en', 'fr']},
            children: {home: ConfigBuilder.page({type: Seeded})}
          })
        }
      })
    }
  }
  const {sqlite, store} = await createStore(new MemorySource(), seededConfig)
  try {
    await store.sync()
    const rows = await store.find({
      path: 'home',
      status: 'all',
      select: {id: Entry.id, locale: Entry.locale}
    })
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map(row => row.id)).size).toBe(1)
    expect(rows.map(row => row.locale).sort()).toEqual(['en', 'fr'])
  } finally {
    sqlite.close()
  }
})

test('SQLite seed defaults follow config changes without rewriting source', async () => {
  const Seeded = ConfigBuilder.document('Seeded', {
    fields: {rate: Field.number('Rate')}
  })
  function seededConfig(title: string, rate: number): Config {
    return {
      schema: {Seeded},
      workspaces: {
        main: ConfigBuilder.workspace('Main', {
          source: 'content',
          roots: {
            pages: ConfigBuilder.root('Pages', {
              children: {
                vat: ConfigBuilder.page({
                  type: Seeded,
                  fields: {title, rate}
                })
              }
            })
          }
        })
      }
    }
  }
  const source = new MemorySource()
  const initial = await createStore(source, seededConfig('VAT', 6))
  await initial.store.sync()
  expect(await initial.store.get({path: 'vat', type: Seeded})).toMatchObject({
    title: 'VAT',
    rate: 6
  })
  initial.sqlite.close()

  const changed = await createStore(source, seededConfig('BTW', 21))
  try {
    await changed.store.sync()
    expect(await changed.store.get({path: 'vat', type: Seeded})).toMatchObject({
      title: 'BTW',
      rate: 21
    })
  } finally {
    changed.sqlite.close()
  }
})
