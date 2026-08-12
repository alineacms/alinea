import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import {selectAtom} from 'jotai/utils'
import {eventsAtom, graphAtom} from './core.js'
import {dispense} from './utils.js'

interface IndexState {
  sha?: string
  entryRevisions: ReadonlyMap<string, string>
}

const indexStateValueAtom = atom<IndexState>({entryRevisions: new Map()})

const indexStateAtom = Object.assign(
  atom(
    get => get(indexStateValueAtom),
    (get, set) => {
      const events = get(eventsAtom)
      const listen = (event: Event) => {
        if (!(event instanceof IndexEvent)) return
        const data = event.data
        if (data.op !== 'index') return
        set(indexStateValueAtom, current => {
          const entryRevisions = new Map(current.entryRevisions)
          for (const id of data.ids) entryRevisions.set(id, data.sha)
          return {sha: data.sha, entryRevisions}
        })
      }
      events.addEventListener(IndexEvent.type, listen)
      return () => {
        events.removeEventListener(IndexEvent.type, listen)
      }
    }
  ),
  {onMount: (init: () => () => void) => init()}
)

export const shaAtom = atom(async get => {
  const current = get(indexStateAtom).sha
  if (current) return current
  return readGraphSha(get(graphAtom))
})

export const entryRevisionAtom = dispense((id: string) =>
  selectAtom(indexStateAtom, state => state.entryRevisions.get(id))
)

export const syncAtom = atom(null, async (get, set) => {
  const graph = get(graphAtom)
  if (!isSyncableGraph(graph)) return
  const sha = await graph.sync()
  set(indexStateValueAtom, current => ({...current, sha}))
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
