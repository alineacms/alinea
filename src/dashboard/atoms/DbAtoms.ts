import {Database} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {Connection} from 'alinea/core'
import {Graph} from 'alinea/core/Graph'
import {Mutation} from 'alinea/core/Mutation'
import {Realm} from 'alinea/core/pages/Realm'
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
import {cleanupPending, pendingMap} from './PendingAtoms.js'

export const storeAtom = atom(createPersistentStore)

const limit = pLimit(1)

async function cancelMutations(store: Store) {
  console.log('Canceling mutations')
  // Cancel previous mutations if they were applied
  try {
    await store(sql`rollback to mutations`)
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

export const localDbAtom = atom(
  async get => {
    let pendingLock: Promise<unknown> = Promise.resolve()
    const config = get(configAtom)
    const client = get(clientAtom)
    const store = await get(storeAtom)
    const db = new Database(store, config)

    await limit(() => syncDb(db, client, store))
    await db.meta().then(meta => cleanupPending(meta.modifiedAt))

    async function resolve(params: Connection.ResolveParams) {
      await pendingLock
      return db.resolve(params)
    }

    async function sync() {
      const changed = await limit(() =>
        syncDb(db, client, store).catch(() => [] as Array<string>)
      )
      await db.meta().then(meta => cleanupPending(meta.modifiedAt))
      return changed
    }

    const applyPending = (pending: Array<Mutation>) =>
      (pendingLock = limit(async () => {
        await cancelMutations(store)

        // Open a savepoint in which we apply all mutations
        // we can rollback the savepoint on next sync
        // This requires we use the same single connection for all reads
        // Alternatively we could create a new db here

        // Apply all mutations
        await db.applyMutations(pending)

        return pending.map(({entryId}) => entryId)
      }))

    return {db, resolve, sync, applyPending}
  },
  (get, set) => {
    const update = () => set(pendingUpdateAtom)
    update()
    pendingMap.observeDeep(update)
    return () => pendingMap.unobserveDeep(update)
  }
)
localDbAtom.onMount = init => init()

export const dbUpdateAtom = atom(null, async (get, set) => {
  const {sync, applyPending} = await get(localDbAtom)
  const changed = await sync()
  const pending = [...pendingMap.values()]
  const updated = await applyPending(pending)
  set(changedEntriesAtom, changed.concat(updated))
})

export const pendingUpdateAtom = atom(null, async (get, set) => {
  const pending = [...pendingMap.values()]
  const {applyPending} = await get(localDbAtom)
  set(changedEntriesAtom, await applyPending(pending))
})

export const graphAtom = atom(async get => {
  const config = get(configAtom)
  const {resolve} = await get(localDbAtom)
  return {
    drafts: new Graph(config, async params => {
      return resolve({
        ...params,
        realm: Realm.Draft
      })
    }),
    active: new Graph(config, async params => {
      return resolve({
        ...params,
        realm: Realm.PreferDraft
      })
    }),
    all: new Graph(config, async params => {
      return resolve({
        ...params,
        realm: Realm.All
      })
    })
  }
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

export function useDbUpdater(everySeconds = 1000 * 60) {
  const forceDbUpdate = useSetAtom(dbUpdateAtom)
  useEffect(() => {
    const interval = setInterval(forceDbUpdate, everySeconds)
    return () => clearInterval(interval)
  }, [everySeconds, forceDbUpdate])
}
