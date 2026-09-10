import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {WritableGraph} from '#/core/db/WritableGraph.js'
import {atom} from 'jotai'
import {selectAtom} from 'jotai/utils'
import {eventsAtom, graphAtom} from './core.js'
import {dispense} from './utils.js'

interface IndexState {
  sha?: string
  revision: number
  error?: Error
  entryRevisions: ReadonlyMap<string, string>
}

const indexStateValueAtom = atom<IndexState>({
  revision: 0,
  entryRevisions: new Map()
})

const indexStateAtom = Object.assign(
  atom(
    get => get(indexStateValueAtom),
    (get, set) => {
      const events = get(eventsAtom)
      const listen = (event: Event) => {
        if (!(event instanceof IndexEvent)) return
        const data = event.data
        if (data.op === 'invalidate') {
          set(indexStateValueAtom, current => ({
            ...current,
            revision: current.revision + 1,
            error: data.error
          }))
          return
        }
        if (data.op !== 'index') return
        set(indexStateValueAtom, current => {
          const entryRevisions = new Map(current.entryRevisions)
          const revision = current.revision + 1
          for (const id of data.ids)
            entryRevisions.set(id, `${data.sha}:${revision}`)
          return {sha: data.sha, revision, entryRevisions}
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
  const state = get(indexStateAtom)
  if (state.error) throw state.error
  const current = state.sha
  if (current) return current
  return readGraphSha(get(graphAtom))
})

export const graphRevisionAtom = atom(get => {
  const state = get(indexStateAtom)
  if (state.error) throw state.error
  return state.revision
})

export const entryRevisionAtom = dispense((id: string) =>
  selectAtom(indexStateAtom, state => {
    if (state.error) throw state.error
    return state.entryRevisions.get(id)
  })
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
  graph: WritableGraph
): string | Promise<string> | undefined {
  return (graph as Partial<GraphWithSha>).sha
}

function isSyncableGraph(
  graph: WritableGraph
): graph is WritableGraph & SyncableGraph {
  return typeof (graph as Partial<SyncableGraph>).sync === 'function'
}
