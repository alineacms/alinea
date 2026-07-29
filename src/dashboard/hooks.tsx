import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {User} from '#/core/User.js'
import {createStore, Provider, useAtomValue, useStore} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import type {PropsWithChildren} from 'react'
import {createElement, useMemo, useState} from 'react'
import {
  clientAtom,
  configAtom,
  eventsAtom,
  graphAtom,
  optionsAtom,
  previewTokenRequestsAtom,
  routeLoaderAtom,
  viewsAtom,
  type DashboardInput
} from './atoms/CoreAtoms.js'
import {userAtom} from './atoms/AuthAtoms.js'
import {dashboardRouteLoader} from './atoms/Dashboard.js'
import {dashboardEffectsAtom} from './atoms/DashboardEffectsAtom.js'
import {navigationAtom} from './atoms/NavigationAtoms.js'
import {createDashboardNavigation, currentEntryAtom} from './atoms/PageAtoms.js'
import {policyAtom} from './atoms/PolicyAtoms.js'
import {createBrowserHistory} from './atoms/navigation/History.js'

export * from './editor/EditorScope.js'
export * from './editor/FieldHooks.js'

export function DashboardScopeInternal({
  children,
  dashboard,
  store: providedStore
}: PropsWithChildren<{
  dashboard: DashboardInput
  store?: ReturnType<typeof createStore>
}>) {
  const [store] = useState(createStore)
  return createElement(
    Provider,
    {store: providedStore ?? store},
    createElement(DashboardHydration, {input: dashboard}, children)
  )
}

function DashboardHydration({
  children,
  input
}: PropsWithChildren<{input: DashboardInput}>) {
  useHydrateDashboard(input)
  return children
}

export function useHydrateDashboard(input: DashboardInput) {
  const navigation = useMemo(
    () =>
      createDashboardNavigation(
        input.options.history ?? createBrowserHistory()
      ),
    [input.options.history]
  )
  const previewTokenRequests = useMemo(
    () => new Map<string, Promise<string>>(),
    []
  )
  useHydrateAtoms([
    [graphAtom, input.graph],
    [configAtom, input.config],
    [eventsAtom, input.events],
    [clientAtom, input.client],
    [viewsAtom, input.views],
    [optionsAtom, input.options],
    [navigationAtom, navigation],
    [previewTokenRequestsAtom, previewTokenRequests],
    [routeLoaderAtom, dashboardRouteLoader]
  ] as const)
  useAtomValue(dashboardEffectsAtom)
}

export function useDashboard() {
  return useStore()
}

export function usePolicy() {
  return useAtomValue(policyAtom)
}

export function useUser(): User | null {
  return useAtomValue(userAtom) ?? null
}

export function useGraph(): WriteableGraph {
  return useAtomValue(graphAtom)
}

/**
 * @deprecated Read `currentEntryAtom` directly in dashboard code.
 */
export function useEntry() {
  return useAtomValue(currentEntryAtom)
}
