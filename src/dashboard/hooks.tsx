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
  dashboardEffectsAtom,
  dashboardRouteLoader,
  type DashboardInput
} from './atoms/Dashboard.js'
import {previewTokenRequestsAtom} from './atoms/EntryPreviewAtoms.js'
import {eventsAtom, graphAtom} from './atoms/GraphAtoms.js'
import {
  createDashboardNavigation,
  currentEntryAtom,
  navigationAtom,
  routeLoaderAtom
} from './atoms/RoutingAtoms.js'
import {
  clientAtom,
  optionsAtom,
  policyAtom,
  userAtom
} from './atoms/UserAtoms.js'
import {configAtom, viewsAtom} from './atoms/WorkspaceAtoms.js'
import {createBrowserHistory} from './atoms/navigation/History.js'

export * from './editor/EditorScope.js'
export * from './editor/FieldHooks.js'

// Public API: custom dashboard views consume the hooks in this file through
// `alinea/dashboard/hooks` or `alinea/dashboard/store`. Do not deprecate these
// hooks in favor of direct atom access; dashboard atoms are implementation
// details and are not part of the consumer API.

const dashboardContext = createContext<DashboardInput | null>(null)

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
    createElement(
      dashboardContext.Provider,
      {value: dashboard},
      createElement(DashboardState, {dashboard}, children)
    )
  )
}

function DashboardState({
  children,
  dashboard
}: PropsWithChildren<{dashboard: DashboardInput}>) {
  const navigation = useMemo(
    () =>
      createDashboardNavigation(
        dashboard.options.history ?? createBrowserHistory()
      ),
    [dashboard.options.history]
  )
  const previewTokenRequests = useMemo(
    () => new Map<string, Promise<string>>(),
    []
  )
  useHydrateAtoms([
    [graphAtom, dashboard.graph],
    [configAtom, dashboard.config],
    [eventsAtom, dashboard.events],
    [clientAtom, dashboard.client],
    [viewsAtom, dashboard.views],
    [optionsAtom, dashboard.options],
    [navigationAtom, navigation],
    [previewTokenRequestsAtom, previewTokenRequests],
    [routeLoaderAtom, dashboardRouteLoader]
  ] as const)
  useAtomValue(dashboardEffectsAtom)
  return children
}

/**
 * Returns the active dashboard from the nearest dashboard scope.
 */
export function useDashboard(): DashboardInput {
  const dashboard = useContext(dashboardContext)
  assert(dashboard, 'Dashboard not found in context')
  return dashboard
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
 * Returns the entry currently selected in the dashboard.
 */
export function useEntry() {
  return useAtomValue(currentEntryAtom)
}
