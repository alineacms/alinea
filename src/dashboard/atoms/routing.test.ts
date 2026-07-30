import {expect, test} from 'bun:test'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {atom} from 'jotai'
import {entryAtoms} from './entry.js'
import {
  entrySidebarTabAtom,
  loadEntryPage,
  resolveEntrySidebarTab
} from './entry/load.js'
import {policyResourceAtom} from './user.js'
import {setUserRolesAtom} from './dashboard.js'
import {configAtom, workspaceAtoms} from './config.js'
import {
  createRouteLoader,
  currentEntryAtom,
  pageAtom,
  pageResourceAtom
} from './routing.js'

test('the page resource prepares the initial screen', async () => {
  const {store} = await createDashboardAtomFixture()
  const resource = store.get(pageResourceAtom)
  expect(resource).toBeInstanceOf(Promise)
  const page = await resource
  const prepared = await store.get(pageAtom)
  expect(prepared.route).toEqual(page.route)
  expect(prepared.content.type).toBe(page.content.type)
  expect(page.sidebar).toBeDefined()
  expect(store.get(currentEntryAtom)).toBeNull()
})

test('changing user roles re-prepares the current route', async () => {
  const {store} = await createDashboardAtomFixture()
  const previous = await store.get(pageResourceAtom)

  await store.set(setUserRolesAtom, ['editor'])

  const page = await store.get(pageAtom)
  expect(page).not.toBe(previous)
  expect(page.content.canManageMembers).toBe(false)
})

test('entry sidebar defaults match the entry type', () => {
  expect(resolveEntrySidebarTab(MediaFile, 'preview')).toBe('references')
  expect(resolveEntrySidebarTab(MediaLibrary, 'preview')).toBe('history')
})

test('open entry sidebar is prepared with the page', async () => {
  const {child, store} = await createDashboardAtomFixture()
  store.set(entrySidebarTabAtom, 'references')
  let sidebarLoads = 0
  const loadRoute = createRouteLoader({
    config: configAtom,
    policy: policyResourceAtom,
    canManageMembers: atom(Promise.resolve(false)),
    workspace: workspaceAtoms,
    entry: entryAtoms,
    loadEntry(get, entry, locale) {
      return loadEntryPage(get, entry, locale, async () => {
        sidebarLoads++
        throw new Error('References unavailable')
      })
    }
  })
  const page = await loadRoute(
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
  expect(sidebarLoads).toBe(1)
  const sidebar = page.sidebar
  expect(sidebar.data.type).toBe('error')
  expect(sidebar.data.type === 'error' && sidebar.data.error.message).toBe(
    'References unavailable'
  )
})

test('the selected preview is prepared with the entry page', async () => {
  const {child, store} = await createDashboardAtomFixture()
  let sidebarLoads = 0
  const loadRoute = createRouteLoader({
    config: configAtom,
    policy: policyResourceAtom,
    canManageMembers: atom(Promise.resolve(false)),
    workspace: workspaceAtoms,
    entry: entryAtoms,
    loadEntry(get, entry, locale) {
      return loadEntryPage(get, entry, locale, async () => {
        sidebarLoads++
        return {type: 'preview', entry: null, url: undefined}
      })
    }
  })

  const page = await loadRoute(
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
  expect(sidebarLoads).toBe(1)
  expect(page.sidebar).toEqual({
    tab: 'preview',
    open: true,
    data: {type: 'preview', entry: null, url: undefined}
  })
})
