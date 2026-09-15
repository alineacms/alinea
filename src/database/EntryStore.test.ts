import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {transaction} from '#/core/source/Source.js'
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

test('seed translations share an index when locale siblings differ', async () => {
  const Seeded = ConfigBuilder.document('Seeded', {fields: {}})
  function seededConfig(includeSeed: boolean): Config {
    return {
      schema: {Seeded},
      workspaces: {
        main: ConfigBuilder.workspace('Main', {
          source: 'content',
          roots: {
            pages: ConfigBuilder.root('Pages', {
              i18n: {locales: ['en', 'fr']},
              children: includeSeed
                ? {home: ConfigBuilder.page({type: Seeded})}
                : undefined
            })
          }
        })
      }
    }
  }

  const source = new MemorySource()
  const initial = await createStore(source, seededConfig(false))
  await initial.store.sync()
  await initial.store.mutate([
    {
      op: 'create',
      id: 'english-page',
      type: 'Seeded',
      locale: 'en',
      data: {title: 'English page'}
    },
    {
      op: 'create',
      id: 'french-page-1',
      type: 'Seeded',
      locale: 'fr',
      data: {title: 'French page 1'}
    },
    {
      op: 'create',
      id: 'french-page-2',
      type: 'Seeded',
      locale: 'fr',
      data: {title: 'French page 2'}
    }
  ])
  initial.sqlite.close()

  const seeded = await createStore(source, seededConfig(true))
  try {
    await seeded.store.sync()
    const rows = await seeded.store.find({
      path: 'home',
      status: 'all',
      select: {id: Entry.id, index: Entry.index, locale: Entry.locale}
    })
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map(row => row.id)).size).toBe(1)
    expect(new Set(rows.map(row => row.index)).size).toBe(1)
  } finally {
    seeded.sqlite.close()
  }
})

test('entry store finds an existing seed by its seed identity', async () => {
  const Seeded = ConfigBuilder.document('Seeded', {fields: {}})
  const seededConfig: Config = {
    schema: {Seeded},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {
          pages: ConfigBuilder.root('Pages', {
            children: {home: ConfigBuilder.page({type: Seeded})}
          })
        }
      })
    }
  }
  const source = new MemorySource()
  const initial = await createStore(source, seededConfig)
  await initial.store.sync()
  const original = await initial.store.get({
    path: 'home',
    select: {id: Entry.id, seeded: Entry.seeded}
  })
  expect(original.seeded).toBe('/home.json')
  initial.sqlite.close()

  const rename = await transaction(source)
  const renamed = await rename
    .rename('pages/home.json', 'pages/existing-home.json')
    .compile()
  await source.applyChanges({
    fromSha: renamed.from.sha,
    changes: renamed.changes
  })

  const reopened = await createStore(source, seededConfig)
  try {
    await reopened.store.sync()
    const rows = await reopened.store.find({
      seeded: '/home.json',
      status: 'all',
      select: {id: Entry.id, filePath: Entry.filePath}
    })
    expect(rows).toEqual([
      {id: original.id, filePath: 'pages/existing-home.json'}
    ])
  } finally {
    reopened.sqlite.close()
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
