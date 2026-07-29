import {expect, test} from 'bun:test'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {atom, createStore} from 'jotai'
import {entryAtoms} from './entry.js'
import {
  createEntrySidebarResource,
  entrySidebarTabAtom,
  loadEntryPage,
  resolveEntrySidebarTab
} from './entry/load.js'
import {optionsAtom, policyResourceAtom} from './user.js'
import {setUserRolesAtom} from './dashboard.js'
import {configAtom, workspaceAtoms} from './config.js'
import {
  createRouteLoader,
  currentEntryAtom,
  navigationAtom,
  pageAtom
} from './routing.js'

test('page atoms require navigation to commit prepared data', () => {
  const store = createStore()
  store.set(optionsAtom, {
    history: {
      read: () => ({page: 'entry'}),
      push() {},
      replace() {},
      subscribe: () => () => {}
    }
  })
  const navigation = store.get(navigationAtom)

  expect(() => store.get(pageAtom)).toThrow(
    'Dashboard page was read before it was prepared'
  )

  const page = {type: 'empty', canManageMembers: false} as const
  store.set(navigation.prepared, page)

  expect(store.get(pageAtom)).toBe(page)
  expect(store.get(currentEntryAtom)).toBeNull()
})

test('changing user roles re-prepares the current route', async () => {
  const {store} = await createDashboardAtomFixture()
  const navigation = store.get(navigationAtom)
  const previous = {
    type: 'empty',
    canManageMembers: false
  } as const
  store.set(navigation.prepared, previous)

  await store.set(setUserRolesAtom, ['editor'])

  expect(store.get(pageAtom)).not.toBe(previous)
  expect(store.get(pageAtom)).toEqual({
    type: 'empty',
    canManageMembers: false
  })
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
      return loadEntryPage(
        get,
        entry,
        locale,
        createEntrySidebarResource(entry, locale, async () => {
          sidebarLoads++
          throw new Error('References unavailable')
        })
      )
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
  const sidebar = store.get(page.sidebar)
  expect(sidebar.data?.type).toBe('error')
  expect(sidebar.data?.type === 'error' && sidebar.data.error.message).toBe(
    'References unavailable'
  )
})

test('preview sidebar loading does not delay the entry page', async () => {
  const {child, store} = await createDashboardAtomFixture()
  let sidebarLoads = 0
  const loadRoute = createRouteLoader({
    config: configAtom,
    policy: policyResourceAtom,
    canManageMembers: atom(Promise.resolve(false)),
    workspace: workspaceAtoms,
    entry: entryAtoms,
    loadEntry(get, entry, locale) {
      return loadEntryPage(
        get,
        entry,
        locale,
        createEntrySidebarResource(entry, locale, async () => {
          sidebarLoads++
          return new Promise(() => {})
        })
      )
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
  expect(sidebarLoads).toBe(0)
  expect(store.get(page.sidebar)).toEqual({pending: true, data: undefined})
  expect(sidebarLoads).toBe(1)
})
