import type {UploadProgress} from '#/core/db/Operation.js'
import {atom} from 'jotai'
import {
  MutationQueueEvent,
  type MutationQueueEntry
} from '../boot/MutationQueueEvent.js'
import {eventsAtom, graphAtom} from './CoreAtoms.js'

export interface MutationQueueState {
  entries: Array<MutationQueueEntry>
  pending: number
  syncing: number
  failed: number
  blocked: number
  error?: string
}

export function createMutationQueueState(
  entries: Array<MutationQueueEntry>
): MutationQueueState {
  return {
    entries,
    pending: entries.filter(entry => entry.status === 'pending').length,
    syncing: entries.filter(entry => entry.status === 'syncing').length,
    failed: entries.filter(entry => entry.status === 'failed').length,
    blocked: entries.filter(entry => entry.status === 'blocked').length,
    error: entries.find(entry => entry.status === 'failed')?.error
  }
}

interface MutationQueueRetry {
  retryMutationQueue(): Promise<void>
}

interface MutationQueueDiscard {
  discardMutationQueue(): Promise<void>
}

export type UploadProgressUpdate =
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

const mutationQueueStateAtom = atom<MutationQueueState>({
  entries: [],
  pending: 0,
  syncing: 0,
  failed: 0,
  blocked: 0
})

const uploadQueueAtom = atom<Array<MutationQueueEntry>>([])

export const mutationQueueAtom = Object.assign(
  atom(
    get => {
      const uploads = get(uploadQueueAtom)
      const queue = get(mutationQueueStateAtom)
      if (uploads.length === 0) return queue
      return createMutationQueueState([...uploads, ...queue.entries])
    },
    (_get, set) => {
      const events = _get(eventsAtom)
      const listen = (event: Event) => {
        if (event instanceof MutationQueueEvent) {
          set(
            mutationQueueStateAtom,
            createMutationQueueState(event.entries)
          )
        }
      }
      events.addEventListener(MutationQueueEvent.type, listen)
      return () => {
        events.removeEventListener(MutationQueueEvent.type, listen)
      }
    }
  ),
  {onMount: (init: () => () => void) => init()}
)

export const retryMutationQueueAtom = atom(null, async get => {
  const db = get(graphAtom)
  const retry = (db as Partial<MutationQueueRetry>).retryMutationQueue
  if (retry) await retry.call(db)
})

export const discardMutationQueueAtom = atom(null, async (get, set) => {
  const db = get(graphAtom)
  const discard = (db as Partial<MutationQueueDiscard>).discardMutationQueue
  if (discard) await discard.call(db)
  set(uploadQueueAtom, [])
})

export const uploadProgressAtom = atom(
  null,
  (_get, set, update: UploadProgressUpdate) => {
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
        ...current
      ])
      return
    }
    const finished = new Set(update.ids)
    set(uploadQueueAtom, current =>
      current.filter(entry => !finished.has(entry.id))
    )
  }
)
