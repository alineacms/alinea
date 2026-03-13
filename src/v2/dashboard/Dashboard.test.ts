import {expect, test} from 'bun:test'
import {Config} from 'alinea'
import {Entry, createCMS} from 'alinea/core'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {atom, createStore} from 'jotai'
import {Dashboard} from './Dashboard.js'

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {}
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
