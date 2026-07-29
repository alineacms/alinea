import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {ComponentType} from 'react'
import {
  configAtom,
  type DashboardInput,
  type DashboardOptions
} from './CoreAtoms.js'
import {entryAtoms} from './EntryAtoms.js'
import {createRouteLoader} from './loaders/Route.js'
import {canManageMembersAtom, policyResourceAtom} from './PolicyAtoms.js'
import {workspaceAtoms} from './WorkspaceAtoms.js'

export type {DashboardRoute, Route, RouteUpdate} from '../DashboardNav.js'
export type {DashboardCreateEntryRequest} from './CreateEntryAtom.js'
export {createDashboardNavigation} from './PageAtoms.js'

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
