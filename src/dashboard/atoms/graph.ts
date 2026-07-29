import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import {requiredAtom} from './utils.js'

export const graphAtom = requiredAtom<WriteableGraph>('dashboard.graph')
export const eventsAtom = requiredAtom<EventTarget>('dashboard.events')

const currentShaAtom = atom<string>()

export const shaAtom = Object.assign(
  atom(
    async get => {
      const current = get(currentShaAtom)
      if (current) return current
      return readGraphSha(get(graphAtom))
    },
    (get, set) => {
      const events = get(eventsAtom)
      const listen = (event: Event) => {
        if (event instanceof IndexEvent && event.data.op === 'index') {
          set(currentShaAtom, event.data.sha)
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
  const db = get(graphAtom)
  if (!isSyncableGraph(db)) return
  const sha = await db.sync()
  set(currentShaAtom, sha)
  return sha
})

interface SyncableGraph {
  sync: () => Promise<string>
}

interface GraphWithSha {
  sha: string | Promise<string>
}

function readGraphSha(graph: WriteableGraph): string | Promise<string> | void {
  const sha = (graph as Partial<GraphWithSha>).sha
  if (sha !== undefined) return sha
}

function isSyncableGraph(
  graph: WriteableGraph
): graph is WriteableGraph & SyncableGraph {
  return typeof (graph as Partial<SyncableGraph>).sync === 'function'
}
