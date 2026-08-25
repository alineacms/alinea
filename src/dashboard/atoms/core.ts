import {Config} from '#/core/Config.js'
import {LocalConnection} from '#/core/Connection.js'
import type {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom, useStore} from 'jotai'
import type {ComponentType} from 'react'
import type {AppProps} from '../App.js'
import {requiredAtom} from './utils.js'

export const graphAtom = requiredAtom<WriteableGraph>('graph')
export const eventsAtom = requiredAtom<EventTarget>('events')
export const configAtom = requiredAtom<Config>('config')
export const clientAtom = requiredAtom<LocalConnection>('client')
export const viewsAtom = atom<Record<string, ComponentType>>({})
export const localAtom = requiredAtom<boolean>('local')
export const alineaDevAtom = requiredAtom<boolean>('alineaDev')
export const authenticatedUserAtom = atom<User>()
export const authenticatedPolicyAtom = atom<Policy>()

export function useInitAtoms(props: AppProps) {
  const store = useStore()
  store.set(graphAtom, props.graph)
  store.set(eventsAtom, props.events)
  store.set(configAtom, props.config)
  store.set(clientAtom, props.client)
  store.set(viewsAtom, props.views)
  store.set(localAtom, Boolean(props.local))
  store.set(alineaDevAtom, Boolean(props.alineaDev))
  if (props.authenticated) {
    store.set(authenticatedUserAtom, props.authenticated.user)
    store.set(authenticatedPolicyAtom, props.authenticated.policy)
  }
}
