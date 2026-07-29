import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import type {ComponentType} from 'react'
import {entryAtoms} from './EntryAtoms.js'
import {entryRevisionAtom} from './EntrySupport.js'
import {eventsAtom} from './GraphAtoms.js'
import {createRouteLoader} from './loaders/Route.js'
import {reloadPageAtom, routeAtom} from './RoutingAtoms.js'
import {
  canManageMembersAtom,
  type DashboardOptions,
  policyResourceAtom
} from './UserAtoms.js'
import {configAtom, workspaceAtoms} from './WorkspaceAtoms.js'

export type {DashboardRoute, Route, RouteUpdate} from '../DashboardNav.js'
export {createDashboardNavigation} from './RoutingAtoms.js'

export interface DashboardInput {
  graph: WriteableGraph
  config: Config
  events: EventTarget
  client: LocalConnection
  views: Record<string, ComponentType>
  options: DashboardOptions
}

export interface DashboardCreateEntryRequest {
  workspace: string
  root: string
  locale: string | null
  type: string
  title: string
  parentId?: string
  copyFrom?: string
  insertOrder?: 'first' | 'last'
}

export const dashboardRouteLoader = createRouteLoader({
  config: configAtom,
  policy: policyResourceAtom,
  canManageMembers: canManageMembersAtom,
  workspace: workspaceAtoms,
  entry: entryAtoms
})

export function createDashboard(
  graph: WriteableGraph,
  config: Config,
  events: EventTarget,
  client: LocalConnection,
  views: Record<string, ComponentType>,
  options: DashboardOptions = {}
): DashboardInput {
  return {graph, config, events, client, views, options}
}

export const dashboardEffectsAtom = Object.assign(
  atom(
    () => undefined,
    (get, set) => {
      const events = get(eventsAtom)
      const listen = (event: Event) => {
        if (!(event instanceof IndexEvent) || event.data.op !== 'entry') return
        const id = event.data.id
        set(entryRevisionAtom(id), current => current + 1)
        if (get(routeAtom).entry === id) void set(reloadPageAtom)
      }
      events.addEventListener(IndexEvent.type, listen)
      return () => {
        events.removeEventListener(IndexEvent.type, listen)
      }
    }
  ),
  {
    onMount(start: () => () => void) {
      return start()
    }
  }
)
