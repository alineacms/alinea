import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import {startTransition, type SetStateAction} from 'react'
import {
  MutationQueueEvent,
  type MutationQueueEntry
} from '../boot/MutationQueueEvent.js'
import {authAtom, authRequiredAtom} from './auth.js'
import {clientAtom, eventsAtom, graphAtom} from './core.js'

export interface DashboardMutationQueue {
  entries: Array<MutationQueueEntry>
  pending: number
  syncing: number
  failed: number
  blocked: number
  error?: string
}

export type DashboardTheme = 'system' | 'light' | 'dark'

interface MutationQueueRetry {
  retryMutationQueue(): Promise<void>
}

interface MutationQueueDiscard {
  discardMutationQueue(): void
}

interface LogoutConnection {
  logout(): Promise<void>
}

const dashboardThemeStorageKey = 'alinea-dashboard-theme'

export class DashboardAtoms {
  #mutationQueue = atom<DashboardMutationQueue>(mutationQueueState([]))
  #themeStorage = atomWithStorage<DashboardTheme>(
    dashboardThemeStorageKey,
    'system',
    undefined
  )

  mutationQueue = Object.assign(
    atom(
      get => get(this.#mutationQueue),
      (_get, set) => {
        const events = _get(eventsAtom)
        const listen = (event: Event) => {
          if (!(event instanceof MutationQueueEvent)) return
          startTransition(() => {
            set(this.#mutationQueue, mutationQueueState(event.entries))
          })
        }
        events.addEventListener(MutationQueueEvent.type, listen)
        return () => events.removeEventListener(MutationQueueEvent.type, listen)
      }
    ),
    {onMount: (initialize: () => void) => initialize()}
  )

  retryMutationQueue = atom(null, async get => {
    const graph = get(graphAtom) as WriteableGraph & Partial<MutationQueueRetry>
    if (graph.retryMutationQueue) await graph.retryMutationQueue()
  })

  discardMutationQueue = atom(null, get => {
    const graph = get(graphAtom) as WriteableGraph &
      Partial<MutationQueueDiscard>
    graph.discardMutationQueue?.()
  })

  theme = Object.assign(
    atom(
      get => get(this.#themeStorage),
      (get, set, update: SetStateAction<DashboardTheme>) => {
        const current = get(this.#themeStorage)
        const next = typeof update === 'function' ? update(current) : update
        set(this.#themeStorage, next)
        applyDashboardTheme(next)
      }
    ),
    {
      onMount(setTheme: (update: SetStateAction<DashboardTheme>) => void) {
        setTheme(current => current)
      }
    }
  )

  canLogout = atom(get => {
    if (!get(authRequiredAtom)) return false
    const client = get(clientAtom) as LocalConnection &
      Partial<LogoutConnection>
    return typeof client.logout === 'function'
  })

  logout = atom(null, async (get, set) => {
    const client = get(clientAtom) as LocalConnection &
      Partial<LogoutConnection>
    if (client.logout) await client.logout()
    await set(authAtom, {type: 'check'})
  })
}

export const dashboardAtoms = new DashboardAtoms()

function mutationQueueState(
  entries: Array<MutationQueueEntry>
): DashboardMutationQueue {
  return {
    entries,
    pending: entries.filter(entry => entry.status === 'pending').length,
    syncing: entries.filter(entry => entry.status === 'syncing').length,
    failed: entries.filter(entry => entry.status === 'failed').length,
    blocked: entries.filter(entry => entry.status === 'blocked').length,
    error: entries.find(entry => entry.status === 'failed')?.error
  }
}

let enableThemeTransitionsFrame: number | undefined

function applyDashboardTheme(theme: DashboardTheme) {
  if (typeof document === 'undefined') return
  const {body, documentElement} = document
  if (body) {
    body.dataset.disableTransition = 'true'
    void body.offsetWidth
    if (enableThemeTransitionsFrame)
      cancelAnimationFrame(enableThemeTransitionsFrame)
    enableThemeTransitionsFrame = requestAnimationFrame(() => {
      enableThemeTransitionsFrame = requestAnimationFrame(() => {
        body.removeAttribute('data-disable-transition')
        enableThemeTransitionsFrame = undefined
      })
    })
  }
  if (theme === 'system') documentElement.removeAttribute('data-theme')
  else documentElement.dataset.theme = theme
}
