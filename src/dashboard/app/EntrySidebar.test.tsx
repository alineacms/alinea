import {cleanup, fireEvent, render, screen, waitFor} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import type {Entry} from '#/core/Entry.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {EntryAtoms} from '#/dashboard/atoms/entry.js'
import {atom, createStore, Provider} from 'jotai'
import {cms} from '../fixture/cms.js'
import {EntrySidebar, entrySidebar} from './EntrySidebar.js'

afterEach(cleanup)

test('loads sidebar data only when its tab is selected', async () => {
  const selectedEntry: Entry = {
    active: true,
    childrenDir: 'pages/entry',
    data: {title: 'Entry'},
    fileHash: '',
    filePath: 'pages/entry.json',
    id: 'entry-id',
    index: 'a0',
    level: 0,
    locale: null,
    main: true,
    parentDir: 'pages',
    parentId: null,
    parents: [],
    path: 'entry',
    root: 'pages',
    rowHash: '',
    searchableText: '',
    seeded: null,
    status: 'published',
    title: 'Entry',
    type: 'Page',
    url: '/entry',
    workspace: 'simple'
  }
  const entry = new EntryAtoms(
    selectedEntry.id,
    atom({
      id: selectedEntry.id,
      type: selectedEntry.type,
      parentId: selectedEntry.parentId,
      workspace: selectedEntry.workspace,
      root: selectedEntry.root,
      hasChildren: false,
      parents: [],
      entries: [selectedEntry]
    } as never)
  )
  const localeData = entry.locales(null)
  const references = {
    references: [],
    total: 0,
    scan: {scanned: 0, total: 0, complete: true}
  }
  let resolveReferences = () => {}
  const referencesPending = new Promise<void>(resolve => {
    resolveReferences = resolve
  })
  let referenceLoads = 0
  entry.incomingReferencesReady = atom(async () => {
    referenceLoads++
    await referencesPending
    return references
  })
  entry.incomingReferences = atom(references)
  let resolveHistory = () => {}
  const historyPending = new Promise<void>(resolve => {
    resolveHistory = resolve
  })
  let historyLoads = 0
  localeData.historyReady = atom(async () => {
    historyLoads++
    await historyPending
    return []
  })
  localeData.history = atom([])
  const store = createStore()
  store.set(configAtom, cms.config)
  let sidebar = await entrySidebar(store.get, entry, localeData)
  expect(sidebar).toBeDefined()

  const view = render(
    <Provider store={store}>
      <EntrySidebar {...sidebar!} />
    </Provider>
  )

  expect(referenceLoads).toBe(0)
  expect(historyLoads).toBe(0)
  expect(
    screen.getByRole('tab', {name: 'Preview'}).getAttribute('aria-selected')
  ).toBe('true')

  fireEvent.click(screen.getByRole('tab', {name: 'References'}))
  const referencesPage = entrySidebar(store.get, entry, localeData)
  await waitFor(() => expect(referenceLoads).toBe(1))
  expect(
    screen.getByRole('tab', {name: 'Preview'}).getAttribute('aria-selected')
  ).toBe('true')
  expect(historyLoads).toBe(0)
  resolveReferences()
  sidebar = await referencesPage
  view.rerender(
    <Provider store={store}>
      <EntrySidebar {...sidebar!} />
    </Provider>
  )
  expect(
    screen.getByRole('tab', {name: 'References'}).getAttribute('aria-selected')
  ).toBe('true')

  const nextSelectedEntry = {
    ...selectedEntry,
    id: 'next-entry-id',
    filePath: 'pages/next-entry.json',
    path: 'next-entry',
    title: 'Next entry',
    url: '/next-entry'
  }
  const nextEntry = new EntryAtoms(
    nextSelectedEntry.id,
    atom({
      id: nextSelectedEntry.id,
      type: nextSelectedEntry.type,
      parentId: nextSelectedEntry.parentId,
      workspace: nextSelectedEntry.workspace,
      root: nextSelectedEntry.root,
      hasChildren: false,
      parents: [],
      entries: [nextSelectedEntry]
    } as never)
  )
  let nextReferenceLoads = 0
  nextEntry.incomingReferencesReady = atom(async () => {
    nextReferenceLoads++
    return references
  })
  nextEntry.incomingReferences = atom(references)
  const closedSidebar = await entrySidebar(
    store.get,
    nextEntry,
    nextEntry.locales(null),
    false
  )
  expect(closedSidebar?.selectedTab).toBe('references')
  expect(nextReferenceLoads).toBe(0)
  const nextSidebar = await entrySidebar(
    store.get,
    nextEntry,
    nextEntry.locales(null)
  )
  expect(nextSidebar?.selectedTab).toBe('references')
  expect(nextReferenceLoads).toBe(1)

  fireEvent.click(screen.getByRole('tab', {name: 'History'}))
  sidebar = await entrySidebar(store.get, entry, localeData)
  view.rerender(
    <Provider store={store}>
      <EntrySidebar {...sidebar!} />
    </Provider>
  )
  expect(historyLoads).toBe(0)

  fireEvent.click(screen.getByRole('button', {name: 'Previous versions'}))
  const historyPage = entrySidebar(store.get, entry, localeData)
  await waitFor(() => expect(historyLoads).toBe(1))
  expect(
    screen
      .getByRole('button', {name: 'Previous versions'})
      .getAttribute('aria-expanded')
  ).toBe('false')
  resolveHistory()
  sidebar = await historyPage
  view.rerender(
    <Provider store={store}>
      <EntrySidebar {...sidebar!} />
    </Provider>
  )
  expect(
    screen
      .getByRole('button', {name: 'Previous versions'})
      .getAttribute('aria-expanded')
  ).toBe('true')
})

test('starts loading a browser preview without blocking the sidebar', async () => {
  const selectedEntry: Entry = {
    active: true,
    childrenDir: 'pages/entry',
    data: {title: 'Entry'},
    fileHash: '',
    filePath: 'pages/entry.json',
    id: 'entry-id',
    index: 'a0',
    level: 0,
    locale: null,
    main: true,
    parentDir: 'pages',
    parentId: null,
    parents: [],
    path: 'entry',
    root: 'pages',
    rowHash: '',
    searchableText: '',
    seeded: null,
    status: 'published',
    title: 'Entry',
    type: 'Page',
    url: '/entry',
    workspace: 'simple'
  }
  const entry = new EntryAtoms(
    selectedEntry.id,
    atom({
      id: selectedEntry.id,
      type: selectedEntry.type,
      parentId: selectedEntry.parentId,
      workspace: selectedEntry.workspace,
      root: selectedEntry.root,
      hasChildren: false,
      parents: [],
      entries: [selectedEntry]
    } as never)
  )
  entry.preview = atom(true)
  const localeData = entry.locales(null)
  let resolvePreview = () => {}
  let previewLoads = 0
  localeData.previewUrlReady = atom(async () => {
    previewLoads++
    await new Promise<void>(resolve => {
      resolvePreview = resolve
    })
    return '/preview'
  })
  const store = createStore()
  store.set(configAtom, cms.config)
  let sidebar: Awaited<ReturnType<typeof entrySidebar>>

  const loading = entrySidebar(store.get, entry, localeData).then(result => {
    sidebar = result
  })
  await Promise.resolve()

  expect(previewLoads).toBe(1)
  expect(sidebar!).toBeDefined()
  resolvePreview()
  await loading
})
