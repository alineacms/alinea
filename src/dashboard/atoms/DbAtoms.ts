import {Database} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {Connection, EntryRow} from 'alinea/core'
import {Graph} from 'alinea/core/Graph'
import {MutationType} from 'alinea/core/Mutation'
import {Realm} from 'alinea/core/pages/Realm'
import {Getter, WritableAtom, atom, useSetAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import pLimit from 'p-limit'
import {sql} from 'rado'
import {useEffect} from 'react'
import {
  PersistentStore,
  createPersistentStore
} from '../util/PersistentStore.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {mutationsAtom} from './MutationAtoms.js'

export const storeAtom = atom(createPersistentStore)

const limit = pLimit(1)

async function cancelMutations(store: Store) {
  // Cancel previous mutations if they were applied
  try {
    await store(sql`rollback to mutations`)
  } catch {}
}

async function applyMutations(get: Getter) {
  const store = await get(storeAtom)

  await cancelMutations(store)

  // Open a savepoint in which we apply all mutations
  // we can rollback the savepoint on next sync
  // This requires we use the same single connection for all reads
  // Alternatively we could create a new db here
  await store(sql`savepoint mutations`)

  // Get a list of all local mutations
  const mutations = get(mutationsAtom)
  const pending = get(mutations.pending)

  // Apply all mutations
  for (const mutation of pending) {
    switch (mutation.type) {
      case MutationType.Update:
        await store(EntryRow({entryId: mutation.entryId}).delete())
        await store(EntryRow().insert(mutation.entry))
    }
  }

  return pending.map(mutation => mutation.entryId)
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
    const config = get(configAtom)
    const client = get(clientAtom)
    const store = await get(storeAtom)
    const db = new Database(store, config)
    const {cleanup} = get(mutationsAtom)
    await limit(() => syncDb(db, client, store))
    await db.meta().then(meta => cleanup(meta.modifiedAt))
    return db
  },
  async (get, set) => {
    const client = get(clientAtom)
    const store = await get(storeAtom)
    const db = await get(localDbAtom)
    const changed = await limit(() => syncDb(db, client, store).catch(() => []))
    const {cleanup} = get(mutationsAtom)
    await db.meta().then(meta => cleanup(meta.modifiedAt))
    if (changed.length === 0) return
    for (const id of changed) set(entryRevisionAtoms(id))
    set(changedEntriesAtom, changed)
  }
)

export const resolveAtom: WritableAtom<
  Promise<<T>(params: Connection.ResolveParams) => Promise<T>>,
  [Array<string>],
  void
> = atom(
  async (get, {setSelf}) => {
    const db = await get(localDbAtom)
    await limit(() => applyMutations(get).then(setSelf))
    return db.resolve
  },
  (get, set, changed: Array<string>) => {
    for (const id of changed) set(entryRevisionAtoms(id))
    set(changedEntriesAtom, changed)
  }
)

export const graphAtom = atom(get => {
  const config = get(configAtom)
  return {
    drafts: new Graph(config, async params => {
      const resolve = await get(resolveAtom)
      return resolve({
        ...params,
        realm: Realm.Draft
      })
    }),
    active: new Graph(config, async params => {
      const resolve = await get(resolveAtom)
      return resolve({
        ...params,
        realm: Realm.PreferDraft
      })
    }),
    all: new Graph(config, async params => {
      const resolve = await get(resolveAtom)
      return resolve({
        ...params,
        realm: Realm.All
      })
    })
  }
})

export const entryRevisionAtoms = atomFamily((id: string) => {
  const revision = atom(0)
  return atom(
    get => get(revision),
    (get, set) => set(revision, i => i + 1)
  )
})

export const changedEntriesAtom = atom<Array<string>>([])

export function useDbUpdater(everySeconds = 1000 * 60) {
  const forceDbUpdate = useSetAtom(localDbAtom)
  useEffect(() => {
    const interval = setInterval(forceDbUpdate, everySeconds)
    return () => clearInterval(interval)
  }, [everySeconds, forceDbUpdate])
}
