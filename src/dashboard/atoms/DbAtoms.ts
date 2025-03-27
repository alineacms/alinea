import {EntryDB} from 'alinea/core/db/EntryDB.js'
import {IndexUpdate} from 'alinea/core/db/EntryIndex.js'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource.js'
import {atom, useAtomValue} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useEffect} from 'react'
import {clientAtom, configAtom} from './DashboardAtoms.js'

const source = new IndexedDBSource(window.indexedDB, 'alinea')

const localDb = atom(get => {
  const config = get(configAtom)
  const client = get(clientAtom)
  return new EntryDB(config, source, async () => client)
})

export const dbAtom = atom(async get => {
  const local = get(localDb)
  await local.syncWithRemote()
  return local
})

const dbSha = atom('')
export const dbMetaAtom = atom(
  get => get(dbSha),
  (get, set) => {
    const local = get(localDb)
    const setIndex = () => set(dbSha, local.sha)
    local.index.addEventListener(IndexUpdate.type, setIndex)
    setIndex()
    return () => {
      local.index.removeEventListener(IndexUpdate.type, setIndex)
    }
  }
)
dbMetaAtom.onMount = init => init()

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

export function useDbUpdater(everySeconds = 30) {
  const db = useAtomValue(dbAtom)
  const forceDbUpdate = () => db.syncWithRemote()
  useEffect(() => {
    let interval: any = 0
    interval = setInterval(forceDbUpdate, everySeconds * 1000)
    return () => {
      clearInterval(interval)
    }
  }, [everySeconds, forceDbUpdate])
}
