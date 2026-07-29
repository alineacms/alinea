import {LocalDB} from '#/core/db/LocalDB.js'
import {Config} from '#/index.js'
import {
  createDashboardAtomFixture,
  createDashboardStore,
  DashboardTestPage
} from '#test/DashboardAtomsFixture.js'
import {expect, test} from 'bun:test'
import {atom} from 'jotai'
import {configAtom} from '../CoreAtoms.js'
import {entryAtoms} from '../EntryAtoms.js'
import {policyResourceAtom} from '../PolicyAtoms.js'
import {workspaceAtoms} from '../WorkspaceAtoms.js'
import {createRouteLoader} from './Route.js'

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
  expect(page.items.map(item => item.id)).toEqual([parent._id])
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
