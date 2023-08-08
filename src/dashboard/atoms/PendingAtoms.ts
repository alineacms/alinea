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
  console.log(`Cleanup pending`)
  // Cleanup mutations which are committed
  pendingDoc.transact(() => {
    for (const mutation of pendingMap.values())
      if (modifiedAt > mutation.createdAt)
        pendingMap.delete(mutation.mutationId)
  })
}

export function addPending(mutation: Mutation) {
  const mutationId = createId()
  pendingMap.set(mutationId, {
    ...mutation,
    mutationId,
    createdAt: Date.now()
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
