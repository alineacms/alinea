import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {getWorkspace} from '#/core/Internal.js'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'
import {createStore, Provider} from 'jotai'
import {useMemo, type ComponentType, type PropsWithChildren} from 'react'
import {
  alineaDevAtom,
  clientAtom,
  configAtom,
  eventsAtom,
  graphAtom,
  localAtom,
  viewsAtom
} from './atoms/core.js'
import type {Page} from './atoms/nav.js'
import {rootAtoms} from './atoms/root.js'
import {preloadUserPolicyAtom} from './atoms/user.js'
import {
  DashboardModelScope,
  DashboardScope,
  type Dashboard,
  type DashboardContextValue
} from './hooks.js'

export interface StoryProviderProps {
  client?: LocalConnection
  config?: Config
  events?: EventTarget
  graph?: WriteableGraph
  views?: Record<string, ComponentType>
}

export function StoryProvider({
  children,
  client,
  config,
  events,
  graph,
  views = {}
}: PropsWithChildren<StoryProviderProps>) {
  const store = useMemo(() => {
    const next = createStore()
    next.set(viewsAtom, views)
    next.set(localAtom, true)
    next.set(alineaDevAtom, false)
    next.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
    if (client) next.set(clientAtom, client)
    if (config) next.set(configAtom, config)
    if (events) next.set(eventsAtom, events)
    if (graph) next.set(graphAtom, graph)
    return next
  }, [client, config, events, graph, views])
  const dashboard = useMemo((): DashboardContextValue | undefined => {
    if (!config) return undefined
    const workspaceName = Object.keys(config.workspaces)[0]
    if (!workspaceName) return undefined
    const workspace = getWorkspace(config.workspaces[workspaceName])
    const rootName = Object.keys(workspace.roots)[0]
    if (!rootName) return undefined
    const page: Page = {
      type: 'entry',
      workspace: workspaceName,
      root: rootName,
      entry: undefined,
      locale: null
    }
    return {
      page,
      root: rootAtoms(workspaceName, rootName),
      workspace: {...workspace, name: workspaceName}
    }
  }, [config])
  const dashboardModel = useMemo((): Dashboard | undefined => {
    if (!client || !config || !events || !graph) return undefined
    return {client, config, events, graph, views, options: {local: true}}
  }, [client, config, events, graph, views])
  let content = dashboard ? (
    <DashboardScope value={dashboard}>{children}</DashboardScope>
  ) : (
    children
  )
  if (dashboardModel)
    content = (
      <DashboardModelScope dashboard={dashboardModel}>
        {content}
      </DashboardModelScope>
    )
  return <Provider store={store}>{content}</Provider>
}
