import {LocalDB} from '#/core/db/LocalDB.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {Config} from '#/index.js'
import {
  createDashboardAtomFixture,
  createDashboardStore,
  DashboardTestPage,
  TestEvents
} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {atom} from 'jotai'
import {type EntryAtoms, entryAtoms} from '../entry.js'
import {eventsAtom} from '../graph.js'
import {policyResourceAtom} from '../user.js'
import {configAtom, workspaceAtoms} from '../config.js'
import {createRouteLoader} from '../routing.js'

function routeLoader(canManageMembers = false) {
  return createRouteLoader({
    config: configAtom,
    policy: policyResourceAtom,
    canManageMembers: atom(Promise.resolve(canManageMembers)),
    workspace: workspaceAtoms,
    entry: entryAtoms
  })
}

test('only loads the users page for member managers', async () => {
  const {store} = await createDashboardAtomFixture()
  const signal = new AbortController().signal

  expect(await routeLoader(true)(store.get, {page: 'users'}, signal)).toEqual({
    type: 'users',
    canManageMembers: true
  })

  const denied = await routeLoader(false)(store.get, {page: 'users'}, signal)
  expect(denied.type).toBe('explorer')
  expect(denied.canManageMembers).toBe(false)
})

test('loads a real entry page before returning it to navigation', async () => {
  const {child, store} = await createDashboardAtomFixture()

  const page = await routeLoader()(
    store.get,
    {
      page: 'entry',
      workspace: 'main',
      root: 'pages',
      entry: child._id
    },
    new AbortController().signal
  )

  expect(page.type).toBe('entry')
  if (page.type !== 'entry') return
  expect(page.entry.id).toBe(child._id)
  expect(page.currentEntry?.id).toBe(child._id)
  expect(page.locale).toBeNull()
})

test('loads real explorer entries before returning it to navigation', async () => {
  const {parent, store} = await createDashboardAtomFixture()

  const page = await routeLoader()(
    store.get,
    {
      page: 'entry',
      workspace: 'main',
      root: 'pages'
    },
    new AbortController().signal
  )

  expect(page.type).toBe('explorer')
  if (page.type !== 'explorer') return
  const {items} = page.snapshot
  expect(items.map(item => item.id)).toEqual([parent._id])
  const parentData = store.get(items[0].data).data
  expect(parentData).toBeDefined()
  if (!parentData) return
  expect(store.get(parentData.currentEntryFor(null))).not.toBeInstanceOf(
    Promise
  )
})

test('loads overview children before returning their explorer route', async () => {
  const {child, parent, store} = await createDashboardAtomFixture()

  const page = await routeLoader()(
    store.get,
    {
      page: 'entry',
      workspace: 'main',
      root: 'pages',
      entry: parent._id
    },
    new AbortController().signal
  )

  expect(page.type).toBe('explorer')
  if (page.type !== 'explorer') return
  const {items} = page.snapshot
  expect(items.map(item => item.id)).toEqual([child._id])
  const childData = store.get(items[0].data).data
  expect(childData).toBeDefined()
  if (!childData) return
  expect(store.get(childData.currentEntryFor(null))).not.toBeInstanceOf(Promise)
})

test('keeps a prepared explorer page subscribed to index changes', async () => {
  const {db, parent, store} = await createDashboardAtomFixture()
  const events = new TestEvents()
  store.set(eventsAtom, events)
  const page = await routeLoader()(
    store.get,
    {
      page: 'entry',
      workspace: 'main',
      root: 'pages'
    },
    new AbortController().signal
  )

  expect(page.type).toBe('explorer')
  if (page.type !== 'explorer') return
  const itemsAtom = page.root.explorer.items
  const unsubscribe = store.sub(itemsAtom, () => {})
  const added = await db.create({
    type: DashboardTestPage,
    set: {title: 'Added later'}
  })
  const updated = new Promise<Array<EntryAtoms>>(resolve => {
    const stop = store.sub(itemsAtom, () => {
      const next = store.get(itemsAtom)
      if (
        !(next instanceof Promise) &&
        next.some(item => item.id === added._id)
      ) {
        stop()
        resolve(next)
      }
    })
  })
  events.emit(new IndexEvent({op: 'index', sha: db.sha}))

  const items = await updated
  unsubscribe()
  expect(items.map(item => item.id).sort()).toEqual(
    [added._id, parent._id].sort()
  )
})

test('does not load explorer data for a custom root page', async () => {
  function CustomRoot() {
    return null
  }
  const config = Config.create({
    schema: {Page: DashboardTestPage},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {
          custom: Config.root('Custom', {
            contains: ['Page'],
            view: CustomRoot
          })
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const store = createDashboardStore(config, db, 'custom')

  const page = await routeLoader()(
    store.get,
    {
      page: 'entry',
      workspace: 'main',
      root: 'custom'
    },
    new AbortController().signal
  )

  expect(page.type).toBe('root')
  if (page.type !== 'root') return
  expect(store.get(page.root.view)).toBe(CustomRoot)
})
