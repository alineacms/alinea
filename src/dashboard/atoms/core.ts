import {Config} from '#/core/Config.js'
import {LocalConnection} from '#/core/Connection.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {useStore} from 'jotai'
import {ComponentType} from 'react'
import {AppProps} from '../App.js'
import {requiredAtom} from './utils.js'

export const graphAtom = requiredAtom<WriteableGraph>('graph')
export const eventsAtom = requiredAtom<EventTarget>('events')
export const configAtom = requiredAtom<Config>('config')
export const clientAtom = requiredAtom<LocalConnection>('client')
export const viewsAtom = requiredAtom<Record<string, ComponentType>>('views')
export const localAtom = requiredAtom<boolean>('local')
export const alineaDevAtom = requiredAtom<boolean>('alineaDev')

export function useInitAtoms(props: AppProps) {
  const store = useStore()
  store.set(graphAtom, props.graph)
  store.set(eventsAtom, props.events)
  store.set(configAtom, props.config)
  store.set(clientAtom, props.client)
  store.set(viewsAtom, props.views)
  store.set(localAtom, Boolean(props.local))
  store.set(alineaDevAtom, Boolean(props.alineaDev))
}
