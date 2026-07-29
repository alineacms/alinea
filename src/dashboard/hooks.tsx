import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {createStore, Provider, useAtomValue} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import type {PropsWithChildren} from 'react'
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState
} from 'react'
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
import {dashboardEffectsAtom} from './atoms/DashboardEffectsAtom.js'
import {dashboardRouteLoader, type DashboardAtoms} from './atoms/DashboardAtoms.js'
import {navigationAtom} from './atoms/NavigationAtoms.js'
import {createDashboardNavigation, currentEntryAtom} from './atoms/PageAtoms.js'
import {createBrowserHistory} from './atoms/navigation/History.js'

export * from './editor/EditorScope.js'
export * from './editor/FieldHooks.js'

const dashboardContext = createContext<DashboardAtoms | null>(null)

export function DashboardScopeInternal({
  children,
  dashboard
}: PropsWithChildren<{dashboard: DashboardAtoms}>) {
  const [store] = useState(createStore)
  return createElement(
    Provider,
    {store},
    createElement(
      dashboardContext.Provider,
      {value: dashboard},
      createElement(DashboardHydration, {dashboard}, children)
    )
  )
}

function DashboardHydration({
  children,
  dashboard
}: PropsWithChildren<{dashboard: DashboardAtoms}>) {
  useHydrateDashboard(dashboard.input)
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
  const dashboard = useContext(dashboardContext)
  assert(dashboard, 'Dashboard not found in context')
  return dashboard
}

export function usePolicy() {
  const dashboard = useDashboard()
  return useAtomValue(dashboard.policy)
}

export function useUser(): User | null {
  const dashboard = useDashboard()
  return useAtomValue(dashboard.user) ?? null
}

export function useGraph(): WriteableGraph {
  const dashboard = useDashboard()
  return useAtomValue(dashboard.db)
}

/**
 * @deprecated Read `currentEntryAtom` directly in dashboard code.
 */
export function useEntry() {
  return useAtomValue(currentEntryAtom)
}
