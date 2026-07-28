import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {ComponentType} from 'react'
import type {RouteHistory} from './navigation/History.js'
import {requiredAtom} from './RequiredAtom.js'

export interface DashboardOptions {
  alineaDev?: boolean
  history?: RouteHistory
  local?: boolean
}

export interface DashboardInput {
  graph: WriteableGraph
  config: Config
  events: EventTarget
  client: LocalConnection
  views: Record<string, ComponentType>
  options: DashboardOptions
}

export const graphAtom = requiredAtom<WriteableGraph>('dashboard.graph')
export const configAtom = requiredAtom<Config>('dashboard.config')
export const eventsAtom = requiredAtom<EventTarget>('dashboard.events')
export const clientAtom =
  requiredAtom<LocalConnection>('dashboard.client')
export const viewsAtom =
  requiredAtom<Record<string, ComponentType>>('dashboard.views')
export const optionsAtom =
  requiredAtom<DashboardOptions>('dashboard.options')
export const previewTokenRequestsAtom = requiredAtom<
  Map<string, Promise<string>>
>('dashboard.previewTokenRequests')
