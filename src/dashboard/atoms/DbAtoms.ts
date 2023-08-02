import {Database} from 'alinea/backend'
import {EntryRow} from 'alinea/core'
import {Graph} from 'alinea/core/Graph'
import {MutationType} from 'alinea/core/Mutation'
import {Realm} from 'alinea/core/pages/Realm'
import {atom, useSetAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {sql} from 'rado'
import {useEffect} from 'react'
import {createPersistentStore} from '../util/PersistentStore.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {mutationsAtom} from './MutationAtoms.js'

export const storeAtom = atom(createPersistentStore)

export const localDbAtom = atom(
  async get => {
    const client = get(clientAtom)
    const config = get(configAtom)
    const store = await get(storeAtom)
    const db = new Database(store, config)
    await db.syncWith(client)
    await store.flush()
    return db
  },
  async (get, set) => {
    const client = get(clientAtom)
    const store = await get(storeAtom)
    const db = await get(localDbAtom)
    const changed = await db.syncWith(client).catch(() => [])
    if (!changed.length) return
    for (const id of changed) set(entryRevisionAtoms(id))
    set(changedEntriesAtom, changed)
    await store.flush()
  }
)

export const resolveAtom = atom(async get => {
  // Wait until we're in sync
  const db = await get(localDbAtom)
  // Get a list of all local mutations
  const mutations = get(mutationsAtom)
  const pending = get(mutations.pending)
  // Start a savepoint in which we apply all mutations
  const store = await get(storeAtom)
  await store(sql`savepoint mutations`)
  // Apply all mutations
  for (const mutation of pending) {
    switch (mutation.type) {
      case MutationType.Update:
        await store(EntryRow({entryId: mutation.entryId}).delete())
        await store(EntryRow().insert(mutation.entry))
    }
  }
  // Keep the savepoint going until we get new server info
  return db.resolve
})

export const dbModifiedAtom = atom(async get => {
  get(changedEntriesAtom)
  const db = await get(localDbAtom)
  return (await db.meta()).modifiedAt
})

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
