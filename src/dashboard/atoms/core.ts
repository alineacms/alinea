import {Config} from '#/core/Config.js'
import {LocalConnection} from '#/core/Connection.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {User} from '#/core/User.js'
import {atom, createStore} from 'jotai'
import {type ComponentType, useLayoutEffect, useState} from 'react'
import {AppProps} from '../App.js'
import {requiredAtom} from './utils.js'

export const graphAtom = requiredAtom<WriteableGraph>('graph')
export const eventsAtom = requiredAtom<EventTarget>('events')
export const configAtom = requiredAtom<Config>('config')
export const clientAtom = requiredAtom<LocalConnection>('client')
export const viewsAtom = atom<Record<string, ComponentType>>({})
export const localAtom = requiredAtom<boolean>('local')
export const alineaDevAtom = requiredAtom<boolean>('alineaDev')
/** The signed in user of a dashboard that runs without authentication */
export const localUserAtom = atom<User | undefined>(undefined)

type Store = ReturnType<typeof createStore>

function initAtoms(store: Store, props: AppProps) {
  store.set(graphAtom, props.graph)
  store.set(eventsAtom, props.events)
  store.set(configAtom, props.config)
  store.set(clientAtom, props.client)
  store.set(viewsAtom, props.views)
  store.set(localAtom, Boolean(props.local))
  store.set(alineaDevAtom, Boolean(props.alineaDev))
  store.set(localUserAtom, props.user)
}

/**
 * Creates the dashboard store, initialized from the app props. Later prop
 * changes are synced in a layout effect: writing to the store while rendering
 * would notify subscribed components (such as the activity status) during the
 * render of another component.
 */
export function useDashboardStore(props: AppProps): Store {
  const [store] = useState(() => {
    const store = createStore()
    initAtoms(store, props)
    return store
  })
  useLayoutEffect(() => {
    initAtoms(store, props)
  }, [store, props])
  return store
}
