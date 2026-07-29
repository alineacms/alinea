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
import {entryAtoms} from '../entry/index.js'
import {eventsAtom} from '../graph/index.js'
import {policyResourceAtom} from '../user.js'
import {configAtom, workspaceAtoms} from '../workspace.js'
import {createRouteLoader} from './index.js'

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
  const items = await store.get(page.root.explorer.items)
  expect(items.map(item => item.id)).toEqual([parent._id])
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
  events.emit(new IndexEvent({op: 'index', sha: db.sha}))

  const items = await store.get(itemsAtom)
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
