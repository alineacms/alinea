import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {Mutation} from '#/core/db/Mutation.js'
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

async function previewStore() {
  const created = await createStore()
  const {sqlite, store} = created
  await store.mutate(
    ['page', 'other', 'third'].map(id => ({
      op: 'create' as const,
      id,
      type: 'Page',
      locale: null,
      data: {title: 'Published'}
    }))
  )
  const overlayTables = () =>
    sqlite
      .query<{name: string}, []>(
        `select name from sqlite_temp_master
        where type = 'table' and name like 'alinea_overlay_%_entries'
        order by name`
      )
      .all()
      .map(row => row.name)
  async function preview(id: string, title: string, path?: string) {
    const entry = await store.get({id, select: Entry})
    const {rowHash: _rowHash, fileHash: _fileHash, ...base} = entry
    const moved = path && {
      path,
      url: `/${path}`,
      filePath: entry.filePath.replace(`${entry.path}.json`, `${path}.json`)
    }
    return createEntryRow(
      config,
      {...base, ...moved, title, data: {...entry.data, title, path}},
      entry.status
    )
  }
  const rows = (target: EntryStore, previewed?: Entry) =>
    target.find({
      status: 'all',
      select: {
        id: Entry.id,
        path: Entry.path,
        filePath: Entry.filePath,
        title: Entry.title
      },
      preview: previewed && {entry: previewed}
    })
  async function titles(previewed?: Entry) {
    const found = await store.find({
      select: {id: Entry.id, title: Entry.title},
      preview: previewed && {entry: previewed}
    })
    return Object.fromEntries(found.map(row => [row.id, row.title]))
  }
  return {...created, overlayTables, preview, rows, titles}
}

test('concurrent previews of different entries share one overlay', async () => {
  const {sqlite, store, overlayTables, preview, titles} = await previewStore()
  try {
    const first = await preview('page', 'First')
    const second = await preview('other', 'Second')
    const firstTitles = {page: 'First', other: 'Published', third: 'Published'}
    const secondTitles = {
      page: 'Published',
      other: 'Second',
      third: 'Published'
    }
    // Two editors render at once: every query sees its own payload only.
    const results = await Promise.all(
      [first, second, first, second, first, second].map(titles)
    )
    expect(results).toEqual([
      firstTitles,
      secondTitles,
      firstTitles,
      secondTitles,
      firstTitles,
      secondTitles
    ])
    expect(overlayTables()).toEqual(['alinea_overlay_1_entries'])
    expect(await titles()).toEqual({
      page: 'Published',
      other: 'Published',
      third: 'Published'
    })
    await store.close()
    const tempTables = sqlite
      .query(`select name from sqlite_temp_master where type = 'table'`)
      .all()
    expect(tempTables).toEqual([])
  } finally {
    sqlite.close()
  }
})

test('switching previews restores the previously previewed entry', async () => {
  const {sqlite, store, overlayTables, preview, rows} = await previewStore()
  try {
    const payloads = [
      await preview('page', 'First'),
      await preview('other', 'Other'),
      await preview('page', 'Second'),
      await preview('third', 'Third')
    ]
    for (const previewed of payloads)
      expect(await rows(store, previewed)).toEqual(
        await referenceRows(store, previewed, rows)
      )
    const published = await rows(store)
    const unchanged = (await rows(store, payloads[3])).filter(
      row => row.id !== 'third'
    )
    expect(unchanged).toEqual(published.filter(row => row.id !== 'third'))
    expect(overlayTables()).toHaveLength(1)
  } finally {
    sqlite.close()
  }
})

test('the preview overlay follows syncs of the store', async () => {
  const {sqlite, store, overlayTables, preview, titles} = await previewStore()
  try {
    const first = await preview('page', 'First')
    expect(await titles(first)).toEqual({
      page: 'First',
      other: 'Published',
      third: 'Published'
    })
    await store.mutate([
      {
        op: 'update',
        id: 'other',
        locale: null,
        status: 'published',
        set: {title: 'Updated'}
      }
    ])
    const filePath = await store.get({id: 'third', select: Entry.filePath})
    const tx = await transaction(store.source)
    const removed = await tx.remove(filePath).compile()
    await store.source.applyChanges({
      fromSha: removed.from.sha,
      changes: removed.changes
    })
    await store.sync()
    expect(await titles(first)).toEqual({page: 'First', other: 'Updated'})
    expect(overlayTables()).toEqual(['alinea_overlay_1_entries'])
  } finally {
    sqlite.close()
  }
})

test('previews switch over a store sourced from its own database', async () => {
  const {sqlite, store, preview} = await previewStore()
  // Like a generated database: the source reads the rows being previewed.
  const layer = await store.database.createOverlay()
  const generated = new EntryStore(config, layer.database, layer.source)
  const title = (previewed: Entry) =>
    generated.get({
      id: previewed.id,
      select: Entry.title,
      preview: {entry: previewed}
    })
  try {
    const first = await preview('page', 'First')
    const other = await preview('other', 'Other')
    for (const previewed of [first, other, first, other])
      expect(await title(previewed)).toBe(previewed.title)
  } finally {
    await generated.close()
    await layer.close()
    sqlite.close()
  }
})

test('previews moving an entry match fresh overlays', async () => {
  const {sqlite, store, overlayTables, preview, rows} = await previewStore()
  try {
    const payloads = [
      await preview('page', 'First'),
      await preview('page', 'Moved', 'moved'),
      await preview('page', 'Restored'),
      await preview('other', 'Other')
    ]
    expect(payloads[1].filePath).not.toBe(payloads[0].filePath)
    for (const previewed of payloads)
      expect(await rows(store, previewed)).toEqual(
        await referenceRows(store, previewed, rows)
      )
    expect(overlayTables()).toHaveLength(1)
  } finally {
    sqlite.close()
  }
})

/** Rows of a preview through an overlay created for it alone. */
async function referenceRows<Row>(
  store: EntryStore,
  previewed: Entry,
  rows: (target: EntryStore, previewed?: Entry) => Promise<Row>
): Promise<Row> {
  const reference = new EntryStore(config, store.database, store.source)
  try {
    return await rows(reference, previewed)
  } finally {
    await reference.close()
  }
}

test('entry store materializes configured seeds in every locale', async () => {
  const Seeded = ConfigBuilder.document('Seeded', {fields: {}})
  const seededConfig: Config = {
    schema: {Seeded},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {
          pages: ConfigBuilder.root('Pages', {
            i18n: {locales: ['nl-BE', 'fr-BE']},
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
    expect(rows.map(row => row.locale).sort()).toEqual(['fr-BE', 'nl-BE'])
    expect(
      await store.get({
        path: 'home',
        locale: 'nl-be',
        select: Entry.locale
      })
    ).toBe('nl-BE')
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

test('mutations without an id are rejected without touching data', async () => {
  const {sqlite, store} = await createStore()
  try {
    await store.mutate([
      {
        op: 'create',
        id: 'page',
        type: 'Page',
        locale: null,
        data: {title: 'Page'}
      }
    ])
    const mutations = [
      {op: 'remove', id: undefined},
      {
        op: 'update',
        id: undefined,
        locale: null,
        status: 'published',
        set: {title: 'Changed'}
      },
      {op: 'move', id: undefined, target: 'page', dropPosition: 'before'},
      {op: 'publish', id: undefined, locale: null, status: 'draft'},
      {op: 'unpublish', id: undefined, locale: null},
      {op: 'archive', id: undefined, locale: null}
    ] as unknown as Array<Mutation>
    for (const mutation of mutations)
      await expect(store.mutate([mutation])).rejects.toThrow('missing an id')
    expect(await store.find({select: Entry.id})).toEqual(['page'])
    expect(await store.get({id: 'page', select: Entry.title})).toBe('Page')
  } finally {
    sqlite.close()
  }
})
