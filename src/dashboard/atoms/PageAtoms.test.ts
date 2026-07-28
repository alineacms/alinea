import {expect, test} from 'bun:test'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {atom, createStore} from 'jotai'
import {createType} from './EditorAtoms.js'
import type {EntryDataState} from './EntryAtoms.js'
import {
  createEntrySidebarResource,
  loadEntryPage,
  resolveEntrySidebarTab
} from './loaders/Entry.js'
import type {PreparedRoute} from './loaders/Route.js'
import {navigationAtom} from './NavigationAtoms.js'
import {currentEntryAtom, pageAtom} from './PageAtoms.js'
import {ReactiveNode} from './ReactiveNode.js'
import {createNavigation} from './navigation/Navigation.js'

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

test('entry sidebar defaults match the entry type', async () => {
  const mediaFileType = createType(MediaFile)
  const mediaLibraryType = createType(MediaLibrary)
  expect(resolveEntrySidebarTab(mediaFileType, 'preview')).toBe('references')
  expect(resolveEntrySidebarTab(mediaLibraryType, 'preview')).toBe('history')

  let referenceLoads = 0
  const references = {references: [], total: 0, scan: {} as never}
  const entry = {
    type: atom(mediaFileType),
    incomingReferencesResource: atom(async () => {
      referenceLoads++
      return references
    })
  } as unknown as EntryDataState
  const sidebar = createEntrySidebarResource(entry, null)
  const store = createStore()

  expect(referenceLoads).toBe(0)
  expect(await store.get(sidebar)).toEqual({type: 'references', references})
  expect(referenceLoads).toBe(1)
})

test('entry page loading does not await sidebar data', async () => {
  const version = {id: 'media'} as never
  const entry = {
    type: atom(createType(MediaFile)),
    sourceLocaleFor: () => null,
    languages: () => ({
      versionsResource: atom(Promise.resolve(new Map([['draft', version]]))),
      activeVersionResource: atom(Promise.resolve(version))
    }),
    selectedNodeFor: () => atom(Promise.resolve(new ReactiveNode({}))),
    activeVersionFor: () => atom(Promise.resolve(version)),
    currentEntryFor: () => atom(Promise.resolve(version)),
    parentNeedsTranslationFor: () => atom(Promise.resolve(false)),
    incomingReferencesResource: atom(async () => {
      throw new Error('References unavailable')
    })
  } as unknown as EntryDataState
  const store = createStore()

  const page = await loadEntryPage(store.get, entry, null)

  expect(page.type).toBe('entry')
  const sidebar = await store.get(page.sidebar)
  expect(sidebar.type).toBe('error')
  expect(sidebar.type === 'error' && sidebar.error.message).toBe(
    'References unavailable'
  )
})
