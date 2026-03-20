import {Config} from 'alinea'
import {Entry, createCMS} from 'alinea/core'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {expect, test} from 'bun:test'
import type {TextDropItem} from '@react-types/shared'
import {atom, createStore} from 'jotai'
import {object} from 'alinea/field/object'
import {text} from 'alinea/field/text'
import '../dom.js'
import {Dashboard} from './Dashboard.js'

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {}
})
const Article = Config.document('Article', {
  fields: {
    title: text('Title'),
    seo: object('SEO', {
      fields: {
        description: text('Description')
      }
    })
  }
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    archive: Config.root('Archive'),
    pages: Config.root('Pages', {
      children: {
        seeded1: Config.page({
          type: Page
        })
      }
    })
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})
const cmsWithFields = createCMS({
  schema: {Article},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages')
      }
    })
  }
})

test('dashboard', () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))
  const keys = store.get(dashboard.workspaces)
  expect(keys).toEqual(['main'])

  const main = dashboard.workspace.main
  const rootKeys = store.get(main.roots)
  expect(rootKeys).toEqual(['archive', 'pages'])

  const label = store.get(main.label)
  expect(label).toEqual('Main')
})

test('derives the current root from selection or falls back to the first root', () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))
  const main = dashboard.workspace.main

  const initialRoot = store.get(main.tree.currentRoot)
  expect(initialRoot?.key).toEqual('archive')

  store.set(dashboard.route, {workspace: 'main', root: 'pages'})
  const selectedRoot = store.get(main.tree.currentRoot)
  expect(selectedRoot?.key).toEqual('pages')
})

test('reparents an entry when dropped on a tree node', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))
  const main = dashboard.workspace.main

  const folder = await db.create({
    type: Page,
    root: 'pages',
    set: {title: 'Folder'}
  })
  const child = await db.create({
    type: Page,
    root: 'pages',
    set: {title: 'Child'}
  })

  await store.set(main.tree.onMove, {
    keys: new Set([child._id]),
    dropOperation: 'move',
    target: {
      type: 'item',
      key: folder._id,
      dropPosition: 'on'
    }
  })

  const moved = await db.first({
    id: child._id,
    select: {
      parentId: Entry.parentId,
      root: Entry.root
    },
    status: 'preferDraft'
  })
  expect(moved).toEqual({parentId: folder._id, root: 'pages'})
})

test('moves an entry to another root when dropped beside a root-level target', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))
  const main = dashboard.workspace.main

  const source = await db.create({
    type: Page,
    root: 'pages',
    set: {title: 'Source'}
  })
  const target = await db.create({
    type: Page,
    root: 'archive',
    set: {title: 'Target'}
  })

  await store.set(main.tree.onMove, {
    keys: new Set([source._id]),
    dropOperation: 'move',
    target: {
      type: 'item',
      key: target._id,
      dropPosition: 'before'
    }
  })

  const moved = await db.first({
    id: source._id,
    select: {
      parentId: Entry.parentId,
      root: Entry.root
    },
    status: 'preferDraft'
  })
  expect(moved).toEqual({parentId: null, root: 'archive'})
})

test('accepts external entry drops on a tree node', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))
  const main = dashboard.workspace.main

  const folder = await db.create({
    type: Page,
    root: 'pages',
    set: {title: 'Folder'}
  })
  const child = await db.create({
    type: Page,
    root: 'pages',
    set: {title: 'Child'}
  })

  await store.set(main.tree.onItemDrop, {
    items: [dropTextItem(child._id)],
    dropOperation: 'move',
    isInternal: false,
    target: {
      type: 'item',
      key: folder._id,
      dropPosition: 'on'
    }
  })

  const moved = await db.first({
    id: child._id,
    select: {
      parentId: Entry.parentId,
      root: Entry.root
    },
    status: 'preferDraft'
  })
  expect(moved).toEqual({parentId: folder._id, root: 'pages'})
})

test('accepts external entry drops before a tree item', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))
  const main = dashboard.workspace.main

  const source = await db.create({
    type: Page,
    root: 'pages',
    set: {title: 'Source'}
  })
  const target = await db.create({
    type: Page,
    root: 'archive',
    set: {title: 'Target'}
  })

  await store.set(main.tree.onInsert, {
    items: [dropTextItem(source._id)],
    dropOperation: 'move',
    target: {
      type: 'item',
      key: target._id,
      dropPosition: 'before'
    }
  })

  const moved = await db.first({
    id: source._id,
    select: {
      parentId: Entry.parentId,
      root: Entry.root
    },
    status: 'preferDraft'
  })
  expect(moved).toEqual({parentId: null, root: 'archive'})
})

test('derives editor value from writable field atoms', async () => {
  const db = new TestDB(cmsWithFields.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cmsWithFields.config), atom(db))

  const entry = await db.create({
    type: Article,
    root: 'pages',
    set: {title: 'Hello'}
  })

  const loaded = await store.get(dashboard.entries[entry._id])
  const editor = await store.get(loaded.editor)

  expect(store.get(editor.value)).toMatchObject({
    title: 'Hello',
    path: 'hello'
  })

  store.set(editor.field.title.value, 'Updated')

  expect(store.get(editor.value)).toMatchObject({
    title: 'Updated',
    path: 'hello'
  })
})

test('loads hasChildren before constructing dashboard entries', async () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))

  const parent = await db.create({
    type: Page,
    root: 'pages',
    set: {title: 'Parent'}
  })
  const unsubscribe = store.sub(dashboard.entries[parent._id], () => {})

  const initial = await store.get(dashboard.entries[parent._id])
  expect(initial.hasChildren).toBe(false)

  await db.create({
    type: Page,
    root: 'pages',
    parentId: parent._id,
    set: {title: 'Child'}
  })

  const updated = await store.get(dashboard.entries[parent._id])
  expect(updated.hasChildren).toBe(true)

  unsubscribe()
})

function dropTextItem(id: string): TextDropItem {
  return {
    kind: 'text',
    types: new Set(['application/x-alinea-entry-id', 'text/plain']),
    getText(type: string) {
      if (
        type !== 'application/x-alinea-entry-id' &&
        type !== 'text/plain'
      ) {
        return Promise.reject(new Error(`Unsupported type ${type}`))
      }
      return Promise.resolve(id)
    }
  }
}
