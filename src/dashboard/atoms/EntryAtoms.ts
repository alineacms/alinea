import {Database} from 'alinea/backend'
import {Page} from 'alinea/core/pages/Page'
import {atom, useAtomValue} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useEffect} from 'react'
import {createPersistentStore} from '../util/PersistentStore.js'
import {clientAtom} from './DashboardAtoms.js'

export const storeAtom = atom(createPersistentStore)

export const dbAtom = atom(async get => {
  const client = get(clientAtom)
  const store = await get(storeAtom)
  const db = new Database(store, client.config)
  await db.syncWith(client)
  await store.flush()
  return db
})

export const entryAtoms = atomFamily((id: string) => {
  const entryAtom = atom(async get => {
    const db = await get(dbAtom)
    const entry = await db.find(
      Page({entryId: id})
        .select({
          title: Page.title
        })
        .first()
    )
    return entry
  })
  return entryAtom
})

export function useDbUpdater() {
  const client = useAtomValue(clientAtom)
  const store = useAtomValue(storeAtom)
  const db = useAtomValue(dbAtom)
  useEffect(() => {
    const update = async () => {
      const changed = await db.syncWith(client)
      console.log(changed)
      if (changed.length) await store.flush()
      for (const id of changed) entryAtoms.remove(id)
    }
    const interval = setInterval(update, 5000)
    return () => clearInterval(interval)
  }, [db])
}
