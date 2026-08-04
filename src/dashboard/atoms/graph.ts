import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import {eventsAtom, graphAtom} from './core.js'

const contentShaAtom = atom<string>()

export const shaAtom = Object.assign(
  atom(
    async get => {
      const current = get(contentShaAtom)
      if (current) return current
      return readGraphSha(get(graphAtom))
    },
    (get, set) => {
      const events = get(eventsAtom)
      const listen = (event: Event) => {
        if (event instanceof IndexEvent && event.data.op === 'index') {
          const sha = event.data.sha
          set(contentShaAtom, sha)
        }
      }
      events.addEventListener(IndexEvent.type, listen)
      return () => {
        events.removeEventListener(IndexEvent.type, listen)
      }
    }
  ),
  {onMount: (init: () => () => void) => init()}
)

export const syncAtom = atom(null, async (get, set) => {
  const graph = get(graphAtom)
  if (!isSyncableGraph(graph)) return
  const sha = await graph.sync()
  set(contentShaAtom, sha)
  return sha
})

interface SyncableGraph {
  sync: () => Promise<string>
}

interface GraphWithSha {
  sha: string | Promise<string>
}

function readGraphSha(
  graph: WriteableGraph
): string | Promise<string> | undefined {
  return (graph as Partial<GraphWithSha>).sha
}

function isSyncableGraph(
  graph: WriteableGraph
): graph is WriteableGraph & SyncableGraph {
  return typeof (graph as Partial<SyncableGraph>).sync === 'function'
}
