import {cleanup, fireEvent, render, screen} from '#test/react.js'
import type {EntryStatus} from '#/core/Entry.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Provider, atom} from 'jotai'
import {createStore} from 'jotai/vanilla'
import {afterEach, expect, test} from 'bun:test'
import type {
  DashboardEntryData,
  DashboardEntrySidebarTab,
  DashboardRoute
} from '../store.js'
import {EntrySidebar} from './EntrySidebar.js'

afterEach(cleanup)

test('EntrySidebar keeps selected tab when a media entry falls back to references', () => {
  const store = createStore()
  const selectedTab = atom<DashboardEntrySidebarTab>('preview')
  const dashboard = {
    entrySidebarTab: selectedTab,
    route: atom<DashboardRoute>({})
  }

  const {rerender} = render(
    <Provider store={store}>
      <EntrySidebar entry={entryWithType('Page', dashboard)} />
    </Provider>
  )

  expect(screen.getByRole('tab', {name: 'Preview'}).getAttribute(
    'aria-selected'
  )).toBe('true')

  rerender(
    <Provider store={store}>
      <EntrySidebar entry={entryWithType(MediaFile, dashboard)} />
    </Provider>
  )

  expect(screen.getByRole('tab', {name: 'References'}).getAttribute(
    'aria-selected'
  )).toBe('true')
  expect(screen.queryByRole('tab', {name: 'Preview'})).toBeNull()
  expect(store.get(selectedTab)).toBe('preview')

  fireEvent.click(screen.getByRole('tab', {name: 'References'}))
  expect(store.get(selectedTab)).toBe('preview')

  rerender(
    <Provider store={store}>
      <EntrySidebar entry={entryWithType('Page', dashboard)} />
    </Provider>
  )

  expect(screen.getByRole('tab', {name: 'Preview'}).getAttribute(
    'aria-selected'
  )).toBe('true')

  fireEvent.click(screen.getByRole('tab', {name: 'References'}))
  expect(store.get(selectedTab)).toBe('references')
})

interface TestDashboard {
  entrySidebarTab: ReturnType<typeof atom<DashboardEntrySidebarTab>>
  route: ReturnType<typeof atom<DashboardRoute>>
}

function entryWithType(
  type: unknown,
  dashboard: TestDashboard
): DashboardEntryData {
  const status: EntryStatus = 'published'
  return {
    id: `entry-${String(type)}`,
    dashboard,
    type: atom({type}),
    availableStatuses: atom<Array<EntryStatus>>([status]),
    activeStatus: atom(status),
    activeVersion: atom({main: true}),
    currentlyEditing: atom(undefined),
    selectedVersion: atom({type: 'status' as const, status}),
    history: atom([]),
    preview: atom(null),
    incomingReferencesState: atom({
      pending: false,
      data: {
        references: [],
        total: 0,
        scan: {scanned: 0, total: 0, complete: true}
      },
      scan: {scanned: 0, total: 0, complete: true}
    })
  } as unknown as DashboardEntryData
}
