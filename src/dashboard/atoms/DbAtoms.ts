import {Database} from 'alinea/backend/Database'
import {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {Graph} from 'alinea/core/Graph'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {
  applySuffix,
  entryFileName,
  pathSuffix
} from 'alinea/core/util/EntryFilenames'
import {
  createEntryRow,
  entryParentPaths,
  publishEntryRow
} from 'alinea/core/util/EntryRows'
import debounce from 'debounce-promise'
import {atom, useSetAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import pLimit from 'p-limit'
import {useEffect} from 'react'
import {createPersistentStore} from '../util/PersistentStore.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'

export const persistentStoreAtom = atom(createPersistentStore)

const limit = pLimit(1)

export const dbMetaAtom = atom(async get => {
  const db = await get(localDbAtom)
  get(changedEntriesAtom)
  const meta = await db.db.meta()
  return meta
})

const localDbAtom = atom(async (get, set) => {
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
  const resolver = db.resolver
  const syncDb = async (force = false) => {
    const changed = await db.syncWith(client)
    if (changed.length > 0) await flush()
    return changed
  }
  const debounceSync = debounce(syncDb, 100)
  const sync = (force: boolean) => {
    return limit(() => debounceSync(force).catch(() => [] as Array<string>))
  }

  const applyMutations = async (
    mutations: Array<Mutation>,
    commitHash: string | undefined
  ) => {
    return limit(async () => {
      const update = await db.applyMutations(mutations, commitHash)
      await flush()
      return update
    })
  }
  await limit(syncDb)

  return {db, applyMutations, resolve: resolver.resolve, sync}
})

async function suffixPaths(
  config: Config,
  graph: Graph,
  mutations: Array<Mutation>
): Promise<Array<Mutation>> {
  const res = []
  for (const mutation of mutations) {
    switch (mutation.type) {
      case MutationType.Create: {
        const {entry} = mutation
        const conflictingPaths = await graph.preferPublished.query({
          select: Entry.path,
          filter: {
            _root: entry.root,
            _workspace: entry.workspace,
            _locale: entry.locale,
            _parent: entry.parent ?? null,
            _path: {
              or: [entry.path, {startsWith: entry.path + '-'}]
            }
          }
        })
        const suffix = pathSuffix(entry.path, conflictingPaths)
        if (suffix) {
          const updated = {
            ...entry,
            data: {...entry.data, path: applySuffix(entry.path, suffix)}
          }
          const suffixedEntry = await createEntryRow(
            config,
            publishEntryRow(config, updated)
          )
          const parentPaths = entryParentPaths(config, entry)
          res.push({
            ...mutation,
            file: entryFileName(
              config,
              publishEntryRow(config, updated),
              parentPaths
            ),
            entry: suffixedEntry
          })
          continue
        }
      }
      default:
        res.push(mutation)
    }
  }
  return res
}

export const mutateAtom = atom(
  null,
  async (get, set, mutations: Array<Mutation>, optimistic = false) => {
    const client = get(clientAtom)
    const config = get(configAtom)
    const {applyMutations} = await get(localDbAtom)
    if (optimistic) {
      const changed = await applyMutations(mutations, undefined)
      set(changedEntriesAtom, changed)
    }
    const graph = await get(graphAtom)
    const normalized = await limit(() => suffixPaths(config, graph, mutations))
    const {commitHash} = await client.mutate(normalized)
    if (normalized.length === 0) return
    const changed = await applyMutations(normalized, commitHash)
    set(changedEntriesAtom, changed)
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
  const resolver = await get(localDbAtom)
  return new Graph(config, resolver)
})

const changedAtom = atom<Array<string>>([])
export const changedEntriesAtom = atom(
  get => get(changedAtom),
  (get, set, i18nIds: Array<string>) => {
    set(changedAtom, i18nIds)
    for (const i18nId of i18nIds) set(entryRevisionAtoms(i18nId))
  }
)
export const entryRevisionAtoms = atomFamily((i18nId: string) => {
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
    let interval: any = 0
    interval = setInterval(forceDbUpdate, everySeconds * 1000)
    /*window.addEventListener('visibilitychange', focus, false)
    window.addEventListener('focus', focus, false)*/
    return () => {
      clearInterval(interval)
      /*document.removeEventListener('visibilitychange', focus)
      document.removeEventListener('focus', focus)*/
    }
  }, [everySeconds, forceDbUpdate])
}
