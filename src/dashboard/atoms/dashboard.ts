import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import type {ComponentType} from 'react'
import {entryAtoms} from './entry/index.js'
import {entryRevisionAtom} from './entry/load.js'
import {eventsAtom} from './graph/index.js'
import {createRouteLoader, reloadPageAtom, routeAtom} from './routing/index.js'
import {
  canManageMembersAtom,
  type DashboardOptions,
  policyResourceAtom
} from './user.js'
import {configAtom, workspaceAtoms} from './workspace.js'

export type {DashboardRoute, Route, RouteUpdate} from '../DashboardNav.js'
export {createDashboardNavigation} from './routing/index.js'

export interface Dashboard {
  graph: WriteableGraph
  config: Config
  events: EventTarget
  client: LocalConnection
  views: Record<string, ComponentType>
  options: DashboardOptions
}

export type DashboardInput = Dashboard

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
): Dashboard {
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
