import {IndexEvent} from 'alinea/core/db/IndexEvent'
import {atom, useAtomValue} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useEffect} from 'react'
import {dashboardOptionsAtom} from './DashboardAtoms.js'

export const dbAtom = atom(get => {
  return get(dashboardOptionsAtom).db
})

export const dbUpdateAtom = atom(null, async (get, set) => {
  const db = get(dbAtom)
  await db.sync()
})

const dbSha = atom('')
export const dbMetaAtom = atom(
  get => get(dbSha),
  (get, set) => {
    const local = get(dbAtom)
    const setIndex = (event: Event) => {
      if (event instanceof IndexEvent) set(dbSha, event.subject)
    }
    local.index.addEventListener(IndexEvent.INDEX, setIndex)
    return () => {
      local.index.removeEventListener(IndexEvent.INDEX, setIndex)
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
        if (event instanceof IndexEvent && event.subject === id)
          set(index, i => i + 1)
      }
      local.index.addEventListener(IndexEvent.ENTRY, markEntry)
      return () => {
        local.index.removeEventListener(IndexEvent.ENTRY, markEntry)
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
