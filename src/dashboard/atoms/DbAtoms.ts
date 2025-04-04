import {IndexEvent} from 'alinea/core/db/IndexEvent'
import {atom, useAtomValue} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useEffect} from 'react'
import {dashboardOptionsAtom} from './DashboardAtoms.js'

export const dbAtom = atom(get => {
  return get(dashboardOptionsAtom).db
})

export const dbInitialSync = atom(get => {
  const db = get(dbAtom)
  return db.sync()
})

const metaAtom = atom<string>()
export const dbMetaAtom = atom(
  async get => {
    const local = get(dbAtom)
    return get(metaAtom) ?? local.sync()
  },
  (get, set) => {
    const local = get(dbAtom)
    const listen = (event: Event) => {
      if (event instanceof IndexEvent && event.data.op === 'index')
        set(metaAtom, event.data.sha)
    }
    local.events.addEventListener(IndexEvent.type, listen)
    return () => {
      local.events.removeEventListener(IndexEvent.type, listen)
    }
  }
)
dbMetaAtom.onMount = init => init()

const changedAtom = atom<Array<string>>([])
export const changedEntriesAtom = atom(
  get => get(changedAtom),
  (get, set, ids: Array<string>) => {
    set(changedAtom, ids)
    //for (const id of ids) set(entryRevisionAtoms(id))
  }
)
export const entryRevisionAtoms = atomFamily((id: string) => {
  const index = atom(0)
  const revision = atom(
    get => get(index),
    (get, set) => {
      const local = get(dbAtom)
      const markEntry = (event: Event) => {
        if (
          event instanceof IndexEvent &&
          event.data.op === 'entry' &&
          event.data.id === id
        )
          set(index, i => i + 1)
      }
      local.events.addEventListener(IndexEvent.type, markEntry)
      return () => {
        local.events.removeEventListener(IndexEvent.type, markEntry)
      }
    }
  )
  revision.onMount = init => init()
  return atom(get => get(revision))
})

export function useDbUpdater(everySeconds = 30) {
  const db = useAtomValue(dbAtom)
  const forceDbUpdate = () => db.sync()
  useEffect(() => {
    let interval: any = 0
    interval = setInterval(forceDbUpdate, everySeconds * 1000)
    return () => {
      clearInterval(interval)
    }
  }, [everySeconds, forceDbUpdate])
}
