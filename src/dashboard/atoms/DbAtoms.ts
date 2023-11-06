import {Database} from 'alinea/backend'
import {Resolver} from 'alinea/backend/Resolver'
import {Graph} from 'alinea/core/Graph'
import {Mutation} from 'alinea/core/Mutation'
import debounce from 'debounce-promise'
import {atom, useSetAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import pLimit from 'p-limit'
import {useEffect} from 'react'
import {createPersistentStore} from '../util/PersistentStore.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'

export const persistentStoreAtom = atom(createPersistentStore)

const limit = pLimit(1)

const localDbAtom = atom(async get => {
  const config = get(configAtom)
  const client = get(clientAtom)
  const {store, clear, flush} = await get(persistentStoreAtom)

  let db = new Database(config, store)
  try {
    await db.init()
  } catch {
    await clear()
    db = new Database(config, store)
  }
  const resolver = new Resolver(store, config.schema)
  const syncDb = async (force = false) => {
    const changed = await db.syncWith(client, force)
    if (changed.length > 0) await flush()
    return changed
  }
  const debounceSync = debounce(syncDb, 100)
  const sync = (force: boolean) =>
    limit(() => debounceSync(force).catch(() => [] as Array<string>))
  const applyMutations = async (mutations: Array<Mutation>) => {
    await db.applyMutations(mutations)
    await flush()
  }
  await limit(syncDb)

  return {db, applyMutations, resolve: resolver.resolve, sync}
})

export const mutateAtom = atom(
  null,
  async (get, set, ...mutations: Array<Mutation>) => {
    const client = get(clientAtom)
    await client.mutate(mutations)
    const {applyMutations} = await get(localDbAtom)
    await applyMutations(mutations)
  }
)

export const dbUpdateAtom = atom(
  null,
  async (get, set, force: boolean = false) => {
    const {sync} = await get(localDbAtom)
    const changed = await sync(force)
    set(changedEntriesAtom, changed)
  }
)

export const graphAtom = atom(async get => {
  const config = get(configAtom)
  const {resolve} = await get(localDbAtom)
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

export function useDbUpdater(everySeconds = 30) {
  const forceDbUpdate = useSetAtom(dbUpdateAtom)
  useEffect(() => {
    const interval = setInterval(forceDbUpdate, everySeconds * 1000)
    return () => clearInterval(interval)
  }, [everySeconds, forceDbUpdate])
}
