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

function createStore(source = new MemorySource()) {
  const sqlite = new Database(':memory:')
  const db = connect(sqlite)
  return EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha).then(() => ({
    sqlite,
    store: new EntryStore(config, new EntryDatabase(config, db), source)
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
