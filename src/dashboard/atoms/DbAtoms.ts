import {EntryDB} from 'alinea/core/db/EntryDB.js'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource.js'
import {atom, useAtomValue} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useEffect} from 'react'
import {clientAtom, configAtom} from './DashboardAtoms.js'

const source = new IndexedDBSource(window.indexedDB, 'alinea')

class AtomDB extends EntryDB {}

export const dbAtom = atom(async get => {
  const config = get(configAtom)
  const client = get(clientAtom)
  const local = new AtomDB(config, source, client)
  await local.syncWithRemote()
  return local
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
