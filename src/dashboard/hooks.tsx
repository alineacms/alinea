import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {Entry as EntryRecord} from '#/core/Entry.js'
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
  type Dashboard
} from './atoms/Dashboard.js'
import {previewTokenRequestsAtom} from './atoms/EntryPreviewAtoms.js'
import {eventsAtom, graphAtom} from './atoms/GraphAtoms.js'
import {
  createDashboardNavigation,
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

export type {Dashboard} from './atoms/Dashboard.js'

const dashboardContext = createContext<Dashboard | null>(null)
const entryContext = createContext<EntryRecord<Record<string, unknown>> | null>(
  null
)

export function DashboardScopeInternal({
  children,
  dashboard
}: PropsWithChildren<{dashboard: Dashboard}>) {
  const [store] = useState(createStore)
  return createElement(
    Provider,
    {store},
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
}: PropsWithChildren<{dashboard: Dashboard}>) {
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
export function useDashboard(): Dashboard {
  const dashboard = useContext(dashboardContext)
  assert(dashboard, 'Dashboard not found in context')
  return dashboard
}

/**
 * Returns the active dashboard policy.
 */
export function usePolicy() {
  return useAtomValue(policyAtom)
}

/**
 * Returns the authenticated dashboard user, or null when no user is active.
 */
export function useUser(): User | null {
  return useAtomValue(userAtom) ?? null
}

/**
 * Returns the dashboard graph database for direct read queries.
 */
export function useGraph(): WriteableGraph {
  return useAtomValue(graphAtom)
}

export interface EntryScopeProps {
  entry: EntryRecord<Record<string, unknown>> | null
}

export function EntryScope({
  children,
  entry
}: PropsWithChildren<EntryScopeProps>) {
  return createElement(entryContext.Provider, {value: entry}, children)
}

/**
 * Returns the selected entry version as a plain Entry object.
 *
 * Returns null outside an entry scope. The returned value follows the
 * dashboard's locale and version selection and does not expose internal atoms.
 */
export function useEntry(): EntryRecord<Record<string, unknown>> | null {
  return useContext(entryContext)
}
