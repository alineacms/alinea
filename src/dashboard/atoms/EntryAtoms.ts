import {Database} from 'alinea/backend'
import {atom, useAtom, useAtomValue} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {createPersistentStore} from '../util/PersistentStore.js'
import {clientAtom} from './DashboardAtoms.js'
import {EntryEditor} from './EntryEditor.js'

export const storeAtom = atom(createPersistentStore)

export const dbAtom = atom(async get => {
  const client = get(clientAtom)
  const store = await get(storeAtom)
  const db = new Database(store, client.config)
  await db.syncWith(client)
  await store.flush()
  return db
})

export const updateDbAtom = atom(null, async (get, set) => {
  const client = get(clientAtom)
  const store = await get(storeAtom)
  const db = await get(dbAtom)
  const changed = await db.syncWith(client)
  if (!changed.length) return
  for (const id of changed) set(get(entryAtoms(id)).refresh)
  await store.flush()
})
updateDbAtom.onMount = update => {
  const interval = setInterval(update, 1000 * 60)
  return () => clearInterval(interval)
}

export const entryAtoms = atomFamily((id: string) => {
  return atom(new EntryEditor(id))
})

export function useDbUpdater() {
  useAtom(updateDbAtom)
}

export const useEntryEditor = (id: string) => useAtomValue(entryAtoms(id))
