import type {LocalConnection} from '#/core/Connection.js'
import type {UploadProgress} from '#/core/db/Operation.js'
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
  discardMutationQueue(): Promise<void>
}

interface LogoutConnection {
  logout(): Promise<void>
}

const dashboardThemeStorageKey = 'alinea-dashboard-theme'

const mutationQueueValueAtom = atom<DashboardMutationQueue>(
  mutationQueueState([])
)
const uploadQueueAtom = atom<Array<MutationQueueEntry>>([])
const themeStorageAtom = atomWithStorage<DashboardTheme>(
  dashboardThemeStorageKey,
  'system',
  undefined
)

export const dashboardAtoms = {
  entrySidebarOpen: atom(true),
  mutationQueue: Object.assign(
    atom(
      get => {
        const uploads = get(uploadQueueAtom)
        const queue = get(mutationQueueValueAtom)
        if (uploads.length === 0) return queue
        return mutationQueueState([...uploads, ...queue.entries])
      },
      (_get, set) => {
        const events = _get(eventsAtom)
        const listen = (event: Event) => {
          if (!(event instanceof MutationQueueEvent)) return
          startTransition(() => {
            set(mutationQueueValueAtom, mutationQueueState(event.entries))
          })
        }
        events.addEventListener(MutationQueueEvent.type, listen)
        return () => events.removeEventListener(MutationQueueEvent.type, listen)
      }
    ),
    {onMount: (initialize: () => void) => initialize()}
  ),

  retryMutationQueue: atom(null, async get => {
    const graph = get(graphAtom) as WriteableGraph & Partial<MutationQueueRetry>
    if (graph.retryMutationQueue) await graph.retryMutationQueue()
  }),

  discardMutationQueue: atom(null, async (get, set) => {
    const graph = get(graphAtom) as WriteableGraph &
      Partial<MutationQueueDiscard>
    if (graph.discardMutationQueue) await graph.discardMutationQueue()
    set(uploadQueueAtom, [])
  }),

  uploadProgress: atom(
    null,
    (
      _get,
      set,
      update:
        | {
            type: 'start'
            uploads: Array<{id: string; file: File}>
            destination: MutationQueueEntry['upload']
          }
        | {
            type: 'progress'
            id: string
            progress: UploadProgress
          }
        | {
            type: 'finish'
            ids: Array<string>
          }
        | {
            type: 'fail'
            uploads: Array<{id: string; file: File; error: string}>
            destination: MutationQueueEntry['upload']
          }
    ) => {
      if (update.type === 'start') {
        set(uploadQueueAtom, current => [
          ...update.uploads.map(
            ({id, file}): MutationQueueEntry => ({
              id,
              status: 'syncing',
              upload: update.destination,
              mutations: [
                {
                  op: 'uploadFile',
                  title: file.name,
                  progress: {loaded: 0, total: file.size || undefined}
                }
              ]
            })
          ),
          ...current
        ])
        return
      }
      if (update.type === 'progress') {
        set(uploadQueueAtom, current =>
          current.map(entry => {
            if (entry.id !== update.id) return entry
            return {
              ...entry,
              mutations: entry.mutations.map(mutation => ({
                ...mutation,
                progress: update.progress
              }))
            }
          })
        )
        return
      }
      if (update.type === 'fail') {
        const failedIds = new Set(update.uploads.map(upload => upload.id))
        set(uploadQueueAtom, current => [
          ...update.uploads.map(
            ({id, file, error}): MutationQueueEntry => ({
              id,
              status: 'failed',
              error,
              upload: update.destination,
              mutations: [
                {
                  op: 'uploadFile',
                  title: file.name,
                  progress: {loaded: 0, total: file.size || undefined}
                }
              ]
            })
          ),
          ...current.filter(entry => !failedIds.has(entry.id))
        ])
        return
      }
      set(uploadQueueAtom, current =>
        current.filter(entry => !update.ids.includes(entry.id))
      )
    }
  ),

  theme: Object.assign(
    atom(
      get => get(themeStorageAtom),
      (get, set, update: SetStateAction<DashboardTheme>) => {
        const current = get(themeStorageAtom)
        const next = typeof update === 'function' ? update(current) : update
        set(themeStorageAtom, next)
        applyDashboardTheme(next)
      }
    ),
    {
      onMount(setTheme: (update: SetStateAction<DashboardTheme>) => void) {
        setTheme(current => current)
      }
    }
  ),

  canLogout: atom(get => {
    if (!get(authRequiredAtom)) return false
    const client = get(clientAtom) as LocalConnection &
      Partial<LogoutConnection>
    return typeof client.logout === 'function'
  }),

  logout: atom(null, async (get, set) => {
    const client = get(clientAtom) as LocalConnection &
      Partial<LogoutConnection>
    if (client.logout) await client.logout()
    await set(authAtom, {type: 'check'})
  })
}

export function mutationQueueState(
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
