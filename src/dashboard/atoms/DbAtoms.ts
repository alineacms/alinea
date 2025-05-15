import {IndexEvent} from 'alinea/core/db/IndexEvent'
import {atom, useAtomValue} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useEffect} from 'react'
import {dashboardOptionsAtom} from './DashboardAtoms.js'

const dbAtoms = atom(get => {
  const db = get(dashboardOptionsAtom).db
  const baseMeta = atom<string>()
  const metaAtom = atom(
    async get => {
      return get(baseMeta) ?? db.sync()
    },
    (get, set) => {
      const listen = (event: Event) => {
        if (event instanceof IndexEvent && event.data.op === 'index')
          set(baseMeta, event.data.sha)
      }
      db.events.addEventListener(IndexEvent.type, listen)
      return () => {
        db.events.removeEventListener(IndexEvent.type, listen)
      }
    }
  )
  metaAtom.onMount = init => init()
  return {db, metaAtom}
})

export const dbAtom = atom(get => {
  return get(dbAtoms).db
})

export const dbMetaAtom = atom(get => {
  return get(get(dbAtoms).metaAtom)
})

const pendingMutations = atom(0)
export const pendingAtom = atom(
  get => get(pendingMutations),
  (get, set) => {
    const local = get(dbAtom)
    const listen = (event: Event) => {
      if (event instanceof IndexEvent && event.data.op === 'mutate') {
        const {data} = event
        set(pendingMutations, current => {
          let newPending = current
          if (data.status === 'pending') newPending++
          else newPending--
          return newPending > 0 ? newPending : 0
        })
      }
    }
    local.events.addEventListener(IndexEvent.type, listen)
    return () => {
      local.events.removeEventListener(IndexEvent.type, listen)
    }
  }
)
pendingAtom.onMount = init => init()

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
