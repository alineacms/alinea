import {expect, test} from 'bun:test'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {atom, createStore} from 'jotai'
import {createType} from '../entry/editor.js'
import {entryAtoms} from '../entry/index.js'
import {
  createEntrySidebarResource,
  loadEntryPage,
  resolveEntrySidebarTab
} from '../entry/load.js'
import {policyResourceAtom} from '../user.js'
import {configAtom, workspaceAtoms} from '../workspace.js'
import {
  createRouteLoader,
  currentEntryAtom,
  navigationAtom,
  pageAtom,
  type PreparedRoute
} from './index.js'
import {createNavigation} from './navigation.js'

test('page atoms require navigation to commit prepared data', () => {
  const navigation = createNavigation<PreparedRoute>({
    history: {
      read: () => ({page: 'entry'}),
      push() {},
      replace() {},
      subscribe: () => () => {}
    },
    prepare: async () => ({type: 'empty', canManageMembers: false}) as const
  })
  const store = createStore()
  store.set(navigationAtom, navigation)

  expect(() => store.get(pageAtom)).toThrow(
    'Dashboard page was read before it was prepared'
  )

  const page = {type: 'empty', canManageMembers: false} as const
  store.set(navigation.prepared, page)

  expect(store.get(pageAtom)).toBe(page)
  expect(store.get(currentEntryAtom)).toBeNull()
})

test('entry sidebar defaults match the entry type', () => {
  const mediaFileType = createType(MediaFile)
  const mediaLibraryType = createType(MediaLibrary)
  expect(resolveEntrySidebarTab(mediaFileType, 'preview')).toBe('references')
  expect(resolveEntrySidebarTab(mediaLibraryType, 'preview')).toBe('history')
})

test('open entry sidebar is prepared with the page', async () => {
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
