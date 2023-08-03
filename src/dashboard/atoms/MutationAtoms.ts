import {createId} from 'alinea/core'
import {Mutation, MutationProgress, PendingMutation} from 'alinea/core/Mutation'
import {Atom, atom, useAtomValue} from 'jotai'
import {atomFamily, loadable} from 'jotai/utils'
import {IndexeddbPersistence} from 'y-indexeddb'
import * as Y from 'yjs'
import {dbModifiedAtom} from './DbAtoms.js'
import {yAtom} from './YAtom.js'

const MAP_KEY = 'mutations'

export const mutationsAtom = atom(createMutations)

export type Mutations = ReturnType<typeof createMutations>

function createMutations() {
  const doc = new Y.Doc()
  const mutationMap = doc.getMap<PendingMutation>(MAP_KEY)
  // Todo: Set up provider here
  // Todo: provide a unique name during dev (based on project root dir?)
  const local = new IndexeddbPersistence('@alinea/mutations', doc)

  const pending: Atom<Array<PendingMutation>> = yAtom(mutationMap, () => {
    return [...mutationMap.values()]
  })

  function cleanup(modifiedAt: number) {
    // Cleanup mutations which are finished
    doc.transact(() => {
      for (const mutation of mutationMap.values())
        if (modifiedAt > mutation.createdAt)
          mutationMap.delete(mutation.mutationId)
    })
  }

  function addMutation(mutation: Mutation) {
    const mutationId = createId()
    mutationMap.set(mutationId, {
      ...mutation,
      mutationId,
      createdAt: Date.now()
    })
  }

  const mutationProgress = atomFamily((mutationId: string) => {
    const finishedAtom = loadable(
      atom(async get => {
        const mutation = mutationMap.get(mutationId)
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

  return {
    pending,
    cleanup,
    addMutation,
    mutationProgress
  }
}

export function useMutations() {
  return useAtomValue(mutationsAtom)
}
