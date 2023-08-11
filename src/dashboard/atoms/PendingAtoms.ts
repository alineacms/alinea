import {createId} from 'alinea/core'
import {Mutation, MutationProgress, PendingMutation} from 'alinea/core/Mutation'
import {Atom, atom} from 'jotai'
import {atomFamily, loadable} from 'jotai/utils'
import {IndexeddbPersistence} from 'y-indexeddb'
import * as Y from 'yjs'
import {dbModifiedAtom} from './DbAtoms.js'
import {yAtom} from './YAtom.js'

const MAP_KEY = 'mutations'

export const pendingDoc = new Y.Doc()
export const pendingMap = pendingDoc.getMap<PendingMutation>(MAP_KEY)

// Todo: Set up provider here
// Todo: provide a unique name during dev (based on project root dir?)
const local = new IndexeddbPersistence('@alinea/mutations', pendingDoc)

export const pendingAtom: Atom<Array<PendingMutation>> = yAtom(
  pendingMap,
  () => [...pendingMap.values()]
)

export function cleanupPending(modifiedAt: number) {
  // Cleanup mutations which are committed
  pendingDoc.transact(() => {
    for (const mutation of pendingMap.values()) {
      if (modifiedAt > mutation.createdAt) {
        pendingMap.delete(mutation.mutationId)
      } else {
        // Cleanup mutations which are older than 20 minutes as these may
        // have silently failed
        const duration = Date.now() - mutation.createdAt
        if (duration > 1000 * 60 * 20) pendingMap.delete(mutation.mutationId)
      }
    }
  })
}

export function addPending(...mutations: Array<Mutation>) {
  const mutationId = createId()
  const res: Array<PendingMutation> = []
  pendingDoc.transact(() => {
    for (const mutation of mutations) {
      const pending = {
        ...mutation,
        mutationId,
        createdAt: Date.now()
      }
      pendingMap.set(mutationId, pending)
      res.push(pending)
    }
  })
  return res
}

export function removePending(...mutationIds: Array<string>) {
  pendingDoc.transact(() => {
    for (const mutationId of mutationIds) pendingMap.delete(mutationId)
  })
}

export const pendingProgress = atomFamily((mutationId: string) => {
  const finishedAtom = loadable(
    atom(async get => {
      const mutation = pendingMap.get(mutationId)
      if (!mutation) return MutationProgress.Finished
      const lastModification = await get(dbModifiedAtom)
      return lastModification > mutation.createdAt
        ? MutationProgress.Finished
        : MutationProgress.Pending
    })
  )
  return atom(get => {
    const loader = get(finishedAtom)
    switch (loader.state) {
      case 'hasData':
        return loader.data
          ? MutationProgress.Finished
          : MutationProgress.Pending
      case 'hasError':
        return MutationProgress.Error
      default:
        return MutationProgress.Pending
    }
  })
})
