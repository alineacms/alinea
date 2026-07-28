import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {atom} from 'jotai'
import {eventsAtom, graphAtom} from './CoreAtoms.js'

const currentShaAtom = atom<string>()

export const shaAtom = Object.assign(
  atom(
    async get => get(currentShaAtom),
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

function isSyncableGraph(
  graph: WriteableGraph
): graph is WriteableGraph & SyncableGraph {
  return typeof (graph as Partial<SyncableGraph>).sync === 'function'
}
