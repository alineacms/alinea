import {IndexEvent} from '#/core/db/IndexEvent.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import {eventsAtom, graphAtom} from './core.js'

const contentShaAtom = atom<string>()
const shaResource = Object.assign(
  atom(
    async get => {
      const current = get(contentShaAtom)
      if (current) return current
      const graph = get(graphAtom)
      if (!isSyncableGraph(graph)) return undefined
      return graph.sync()
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
  {onMount: (init: () => void) => init()}
)
export const shaAtom = atom(get => get(shaResource))

interface SyncableGraph {
  sync: () => Promise<string>
}

function isSyncableGraph(
  graph: WriteableGraph
): graph is WriteableGraph & SyncableGraph {
  return typeof (graph as Partial<SyncableGraph>).sync === 'function'
}
