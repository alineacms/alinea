import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
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
    if (client) next.set(clientAtom, client)
    if (config) next.set(configAtom, config)
    if (events) next.set(eventsAtom, events)
    if (graph) next.set(graphAtom, graph)
    return next
  }, [client, config, events, graph, views])
  return <Provider store={store}>{children}</Provider>
}
