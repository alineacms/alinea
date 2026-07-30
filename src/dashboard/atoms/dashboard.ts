import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import type {ComponentType} from 'react'
import {entryRevisionAtom, locallyDeletingEntryAtom} from './entry/load.js'
import {eventsAtom} from './graph.js'
import {reloadPageAtom, routeAtom} from './routing.js'
import {type DashboardOptions, updateUserRolesAtom} from './user.js'

export type {DashboardRoute, Route, RouteUpdate} from '../DashboardNav.js'

export interface Dashboard {
  graph: WriteableGraph
  config: Config
  events: EventTarget
  client: LocalConnection
  views?: Record<string, ComponentType>
  options?: DashboardOptions
}

export const setUserRolesAtom = atom(
  null,
  async (get, set, roles: Array<string>) => {
    await set(updateUserRolesAtom, roles)
    await set(reloadPageAtom)
  }
)

export const dashboardEffectsAtom = Object.assign(
  atom(
    () => undefined,
    (get, set) => {
      const events = get(eventsAtom)
      const listen = (event: Event) => {
        if (!(event instanceof IndexEvent) || event.data.op !== 'entry') return
        const id = event.data.id
        if (get(locallyDeletingEntryAtom) === id) return
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
