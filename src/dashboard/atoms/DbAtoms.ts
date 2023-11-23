import {Database} from 'alinea/backend'
import {EntryResolver} from 'alinea/backend/resolver/EntryResolver'
import {Config, Entry} from 'alinea/core'
import {
  applySuffix,
  entryFileName,
  pathSuffix
} from 'alinea/core/EntryFilenames'
import {Graph} from 'alinea/core/Graph'
import {CreateMutation, Mutation, MutationType} from 'alinea/core/Mutation'
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

export const dbHashAtom = atom(async get => {
  const db = await get(localDbAtom)
  get(changedEntriesAtom)
  const meta = await db.db.meta()
  return meta.contentHash
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
  const resolver = new EntryResolver(db, config.schema)
  const syncDb = async (force = false) => {
    const changed = await db.syncWith(client, force)
    if (changed.length > 0) await flush()
    return changed
  }
  const debounceSync = debounce(syncDb, 100)
  const sync = (force: boolean) =>
    limit(() => debounceSync(force).catch(() => [] as Array<string>))
  const applyMutations = async (
    mutations: Array<Mutation>,
    commitHash: string
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
        const sameLocation = Entry.root
          .is(entry.root)
          .and(
            Entry.workspace.is(entry.workspace),
            Entry.locale.is(entry.locale)
          )
        const sameParent = Entry.parent.is(entry.parent ?? null)
        const isExact = Entry.path.is(entry.path)
        const startsWith = Entry.path.like(entry.path + '-%')
        const condition = sameLocation.and(sameParent, isExact.or(startsWith))
        const conflictingPaths = await graph.preferPublished.find(
          Entry().where(condition).select(Entry.path)
        )
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
  async (get, set, ...mutations: Array<Mutation>) => {
    const client = get(clientAtom)
    const config = get(configAtom)
    const graph = await get(graphAtom)
    const normalized = await limit(() => suffixPaths(config, graph, mutations))
    const {commitHash} = await client.mutate(normalized)
    const {applyMutations} = await get(localDbAtom)
    if (normalized.length === 0) return
    const changed = await applyMutations(normalized, commitHash)
    const i18nIds = normalized
      .filter(
        (mutation): mutation is CreateMutation =>
          mutation.type === MutationType.Create
      )
      .map(mutation => mutation.entry.i18nId)
    set(changedEntriesAtom, changed.concat(i18nIds))
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
