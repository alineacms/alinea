import {expect, test} from 'bun:test'
import {atom, createStore, type Getter} from 'jotai'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardRoot,
  DashboardWorkspace
} from '../Dashboard.js'
import {createRouteLoader, type RouteLoaderOptions} from './Route.js'
import type {EntryPageData} from './Entry.js'

test('loads entry page data before returning it to navigation', async () => {
  const store = createStore()
  const expected = {type: 'entry'} as EntryPageData
  const loadedLocales: Array<string | null> = []
  let childLoads = 0
  const entryData = {
    parentIds: atom<Array<string>>([]),
    view: atom('edit'),
    childrenFor: () => atom(Promise.resolve(['child']))
  } as unknown as DashboardEntryData
  function loadEntry(_get: Getter, locale: string | null) {
    loadedLocales.push(locale)
    return Promise.resolve(expected)
  }
  const entry = {
    readyState: atom(
      Promise.resolve({pending: false, data: entryData, error: undefined})
    )
  } as unknown as DashboardEntry
  const child = {
    readyState: atom(
      Promise.resolve().then(() => {
        childLoads++
        return {pending: false, data: entryData, error: undefined}
      })
    )
  } as unknown as DashboardEntry
  const root = {
    i18n: atom({locales: ['en', 'nl']}),
    childrenFor: () => atom(Promise.resolve(['welcome'])),
    explorer: {
      itemsAt: () => atom(Promise.resolve([]))
    }
  } as unknown as DashboardRoot
  const workspace = {
    roots: atom(['content']),
    tree: {expandedKeys: atom(new Set())},
    root: () => root
  } as unknown as DashboardWorkspace
  const options = {
    policy: atom(Promise.resolve({})),
    canManageMembers: atom(Promise.resolve(false)),
    workspaces: atom(['main']),
    workspace: () => workspace,
    entry: id => (id === 'child' ? child : entry),
    loadEntry: (_get, _entry, locale) => loadEntry(_get, locale)
  } satisfies RouteLoaderOptions

  const load = createRouteLoader(options)
  const page = await load(
    store.get,
    {
      page: 'entry',
      workspace: 'main',
      root: 'content',
      entry: 'welcome',
      locale: 'nl'
    },
    new AbortController().signal
  )

  expect(page).toMatchObject(expected)
  expect(page.canManageMembers).toBe(false)
  expect(loadedLocales).toEqual(['nl'])
  expect(childLoads).toBe(1)
})

test('loads explorer page data before returning it to navigation', async () => {
  const store = createStore()
  let explorerLoads = 0
  const root = {
    i18n: atom(undefined),
    view: atom(undefined),
    childrenFor: () => atom(Promise.resolve([])),
    explorer: {
      itemsAt: () =>
        atom(
          Promise.resolve().then(() => {
            explorerLoads++
            return []
          })
        )
    }
  } as unknown as DashboardRoot
  const workspace = {
    roots: atom(['content']),
    tree: {expandedKeys: atom(new Set())},
    root: () => root
  } as unknown as DashboardWorkspace
  const load = createRouteLoader({
    policy: atom(Promise.resolve({})),
    canManageMembers: atom(Promise.resolve(false)),
    workspaces: atom(['main']),
    workspace: () => workspace,
    entry() {
      throw new Error('Unexpected entry load')
    }
  })

  const page = await load(
    store.get,
    {page: 'entry', workspace: 'main', root: 'content'},
    new AbortController().signal
  )

  expect(page).toEqual({
    type: 'explorer',
    root,
    items: [],
    canManageMembers: false
  })
  expect(explorerLoads).toBe(1)
})

test('does not load explorer data for a custom root page', async () => {
  const store = createStore()
  function CustomRoot() {
    return null
  }
  const root = {
    i18n: atom(undefined),
    view: atom(() => CustomRoot),
    childrenFor: () => atom(Promise.resolve([])),
    explorer: {
      itemsAt() {
        throw new Error('Unexpected explorer load')
      }
    }
  } as unknown as DashboardRoot
  const workspace = {
    roots: atom(['content']),
    tree: {expandedKeys: atom(new Set())},
    root: () => root
  } as unknown as DashboardWorkspace
  const load = createRouteLoader({
    policy: atom(Promise.resolve({})),
    canManageMembers: atom(Promise.resolve(false)),
    workspaces: atom(['main']),
    workspace: () => workspace,
    entry() {
      throw new Error('Unexpected entry load')
    }
  })

  const page = await load(
    store.get,
    {page: 'entry', workspace: 'main', root: 'content'},
    new AbortController().signal
  )

  expect(page).toEqual({type: 'root', root, canManageMembers: false})
})
