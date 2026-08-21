import {act, cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, spyOn, test} from 'bun:test'
import {createStore, Provider, useAtomValue} from 'jotai'
import type {ReactNode} from 'react'
import {MissingEntryError} from '../atoms/entry.js'
import {routeAtom} from '../atoms/nav.js'
import {DashboardErrorBoundary} from './DashboardErrorBoundary.js'

afterEach(cleanup)

function BrokenDashboard(): ReactNode {
  throw new Error('Dashboard data failed to load')
}

function RouteDashboard() {
  const route = useAtomValue(routeAtom)
  if (route.entry === 'broken') return <BrokenDashboard />
  return <p>Dashboard recovered</p>
}

function MissingEntryDashboard() {
  const route = useAtomValue(routeAtom)
  if (route.entry === 'child') throw new MissingEntryError('child')
  return <p>Root</p>
}

test('shows dashboard load failures inside the app', () => {
  const consoleError = spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <Provider>
        <DashboardErrorBoundary>
          <BrokenDashboard />
        </DashboardErrorBoundary>
      </Provider>
    )
  } finally {
    consoleError.mockRestore()
  }

  expect(
    screen.getByRole('heading', {name: 'Oops, something went wrong'})
  ).toBeDefined()
  expect(screen.getByText('Dashboard data failed to load')).toBeDefined()
})

test('recovers from a dashboard error after navigation', () => {
  const store = createStore()
  store.set(routeAtom, {
    workspace: 'workspace',
    root: 'pages',
    entry: 'broken'
  })
  const consoleError = spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <Provider store={store}>
        <DashboardErrorBoundary>
          <RouteDashboard />
        </DashboardErrorBoundary>
      </Provider>
    )
  } finally {
    consoleError.mockRestore()
  }

  act(() => {
    store.set(routeAtom, {
      workspace: 'workspace',
      root: 'pages',
      entry: 'recovered'
    })
  })

  expect(screen.getByText('Dashboard recovered')).toBeDefined()
})

test('redirects a missing mounted entry to its root', () => {
  const store = createStore()
  store.set(routeAtom, {
    workspace: 'workspace',
    root: 'pages',
    entry: 'child'
  })
  const consoleError = spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <Provider store={store}>
        <DashboardErrorBoundary>
          <MissingEntryDashboard />
        </DashboardErrorBoundary>
      </Provider>
    )

    expect(store.get(routeAtom).entry).toBeUndefined()
    expect(screen.getByText('Root')).toBeDefined()
  } finally {
    consoleError.mockRestore()
  }
})
