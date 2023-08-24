import {Database} from 'alinea/backend'
import {Resolver} from 'alinea/backend/Resolver'
import {Store} from 'alinea/backend/Store'
import {Connection} from 'alinea/core'
import {Graph} from 'alinea/core/Graph'
import {Mutation, MutationType, PendingMutation} from 'alinea/core/Mutation'
import {atom, useSetAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import pLimit from 'p-limit'
import {sql} from 'rado'
import {useEffect} from 'react'
import {
  PersistentStore,
  createPersistentStore
} from '../util/PersistentStore.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {
  addPending,
  cleanupPending,
  pendingMap,
  removePending
} from './PendingAtoms.js'

export const storeAtom = atom(createPersistentStore)

const limit = pLimit(1)

async function cancelMutations(store: Store) {
  // Cancel previous mutations if they were applied
  try {
    await store(sql`rollback`)
  } catch {}
}

async function syncDb(
  db: Database,
  client: Connection,
  store: PersistentStore
) {
  // Sync the local db with remote
  await cancelMutations(store)
  const changed = await db.syncWith(client)
  if (changed.length > 0) await store.flush()
  return changed
}

export const dbModifiedAtom = atom(Promise.resolve(0))

const localDbAtom = atom(
  async get => {
    let pendingLock: Promise<unknown> = Promise.resolve()
    const config = get(configAtom)
    const client = get(clientAtom)
    const sourceStore = await get(storeAtom)
    const sourceDb = new Database(sourceStore, config)
    const sourceResolver = new Resolver(sourceStore, config.schema)

    await limit(() => syncDb(sourceDb, client, sourceStore))
    await sourceDb.meta().then(meta => cleanupPending(meta.modifiedAt))

    const pendingStore = sourceStore.clone()
    const pendingDb = new Database(pendingStore, config)
    const pendingResolver = new Resolver(pendingStore, config.schema)

    async function resolvePending(params: Connection.ResolveParams) {
      await pendingLock
      return pendingResolver.resolve(params)
    }

    async function resolveSource(params: Connection.ResolveParams) {
      return sourceResolver.resolve(params)
    }

    // Todo: debounce this
    async function sync() {
      const changed = await limit(() =>
        syncDb(sourceDb, client, sourceStore).catch(() => [] as Array<string>)
      )
      await sourceDb.meta().then(meta => cleanupPending(meta.modifiedAt))
      await pendingDb.syncWith(sourceDb)
      return changed
    }

    const applyPending = (pending: Array<PendingMutation>) =>
      (pendingLock = limit(async (): Promise<Array<string>> => {
        // Apply all mutations
        const remove = []
        for (const mutation of pending) {
          try {
            await pendingDb.applyMutation(mutation)
          } catch (err) {
            remove.push(mutation.mutationId)
          }
        }
        await Database.index(pendingDb.store)

        if (remove.length) removePending(...remove)

        return pending.flatMap(mutation => {
          switch (mutation.type) {
            case MutationType.Edit:
              if (mutation.entry.parent)
                return [mutation.entryId, mutation.entry.parent]
            case MutationType.Discard:
            default:
              return mutation.entryId
          }
        })
      }))

    return {sourceDb, resolvePending, resolveSource, sync, applyPending}
  },
  (get, set) => {
    const update = () => set(pendingUpdateAtom)
    update()
    pendingMap.observeDeep(update)
    return () => pendingMap.unobserveDeep(update)
  }
)
localDbAtom.onMount = init => init()

export const sourceDbAtom = atom(async get => (await get(localDbAtom)).sourceDb)

export const mutateAtom = atom(
  null,
  (get, set, ...mutations: Array<Mutation>) => {
    const client = get(clientAtom)
    const pending = addPending(...mutations)
    return client.mutate(mutations).catch(error => {
      removePending(...pending.map(m => m.mutationId))
      set(
        changedEntriesAtom,
        pending.map(m => m.entryId)
      )
      throw error
    })
  }
)

export const dbUpdateAtom = atom(null, async (get, set) => {
  const {sync, applyPending} = await get(localDbAtom)
  const changed = await sync()
  const pending = [...pendingMap.values()]
  const updated = await applyPending(pending)
  set(changedEntriesAtom, changed /*.concat(updated)*/)
})

export const pendingUpdateAtom = atom(null, async (get, set) => {
  const pending = [...pendingMap.values()]
  const {applyPending} = await get(localDbAtom)
  set(changedEntriesAtom, await applyPending(pending))
})

export const sourceGraphAtom = atom(async get => {
  const config = get(configAtom)
  const {resolveSource: resolve} = await get(localDbAtom)
  return new Graph(config, resolve)
})

export const graphAtom = atom(async get => {
  const config = get(configAtom)
  const {resolvePending: resolve} = await get(localDbAtom)
  return new Graph(config, resolve)
})

const changedAtom = atom<Array<string>>([])
export const changedEntriesAtom = atom(
  get => get(changedAtom),
  (get, set, ids: Array<string>) => {
    set(changedAtom, ids)
    for (const id of ids) set(entryRevisionAtoms(id))
  }
)
export const entryRevisionAtoms = atomFamily((id: string) => {
  const revision = atom(0)
  return atom(
    get => get(revision),
    (get, set) => set(revision, i => i + 1)
  )
})

export function useMutate() {
  return useSetAtom(mutateAtom)
}

export function useDbUpdater(everySeconds = 60) {
  const forceDbUpdate = useSetAtom(dbUpdateAtom)
  useEffect(() => {
    const interval = setInterval(forceDbUpdate, everySeconds * 1000)
    return () => clearInterval(interval)
  }, [everySeconds, forceDbUpdate])
}
