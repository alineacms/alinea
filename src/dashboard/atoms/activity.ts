import type {UploadProgress} from '#/core/db/Operation.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {atom} from 'jotai'
import {startTransition} from 'react'
import {
  type Activity,
  ActivityEvent,
  type ActivitySource
} from '../boot/ActivityEvent.js'
import {eventsAtom, graphAtom} from './core.js'
import {pendingTimerAtom} from './utils.js'

export interface DashboardActivity {
  items: Array<Activity>
  isFetchingUpdates: boolean
  isMutating: boolean
  hasFailed: boolean
  hasFailedMutations: boolean
  hasBlocked: boolean
  canRetry: boolean
  canDiscard: boolean
}

interface ActivityRetry {
  retryActivity(): Promise<void>
}

interface ActivityDiscard {
  discardActivity(): Promise<void>
}

const activityHistoryLimit = 100
const activityValueAtom = atom<Array<Activity>>([])
const uploadActivityAtom = atom<Array<Activity>>([])

const activitySpinnerDelay = 100
const activitySpinnerMinimumDuration = 1000

export const activityPendingAtom = pendingTimerAtom(
  activitySpinnerDelay,
  activitySpinnerMinimumDuration
)

export const activityAtom = Object.assign(
  atom(
    get => {
      const activities = [
        ...get(uploadActivityAtom),
        ...get(activityValueAtom)
      ].sort((left, right) => right.startedAt - left.startedAt)
      return activityState(activities)
    },
    (get, set) => {
      const events = get(eventsAtom)
      const source = get(graphAtom) as WriteableGraph & Partial<ActivitySource>
      let active = true

      function update(activities: Array<Activity>) {
        startTransition(() => set(activityValueAtom, activities))
      }

      function listen(event: Event) {
        if (event instanceof ActivityEvent) update(event.activities)
      }

      events.addEventListener(ActivityEvent.type, listen)
      void source.activities?.().then(
        activities => {
          if (active) update(activities)
        },
        () => {}
      )

      return () => {
        active = false
        events.removeEventListener(ActivityEvent.type, listen)
      }
    }
  ),
  {onMount: (initialize: () => void) => initialize()}
)

export const retryActivityAtom = atom(null, async get => {
  const graph = get(graphAtom) as WriteableGraph & Partial<ActivityRetry>
  if (graph.retryActivity) await graph.retryActivity()
})

export const discardActivityAtom = atom(null, async (get, set) => {
  const graph = get(graphAtom) as WriteableGraph & Partial<ActivityDiscard>
  if (graph.discardActivity) await graph.discardActivity()
  set(uploadActivityAtom, current =>
    current.map(activity =>
      activity.type === 'upload' && activity.status === 'failed'
        ? {
            ...activity,
            status: 'discarded',
            finishedAt: Date.now(),
            error: undefined
          }
        : activity
    )
  )
})

export const uploadProgressAtom = atom(
  null,
  (
    _get,
    set,
    update:
      | {
          type: 'start'
          uploads: Array<{id: string; file: File}>
          destination: Activity['upload']
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
          destination: Activity['upload']
        }
  ) => {
    if (update.type === 'start') {
      const startedAt = Date.now()
      set(uploadActivityAtom, current =>
        trimActivities([
          ...update.uploads.map(
            ({id, file}): Activity => ({
              id,
              type: 'upload',
              status: 'running',
              startedAt,
              upload: update.destination,
              operations: [
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
      )
      return
    }
    if (update.type === 'progress') {
      set(uploadActivityAtom, current =>
        current.map(entry => {
          if (entry.id !== update.id) return entry
          return {
            ...entry,
            operations: entry.operations.map(operation => ({
              ...operation,
              progress: update.progress
            }))
          }
        })
      )
      return
    }
    if (update.type === 'fail') {
      const failedIds = new Set(update.uploads.map(upload => upload.id))
      set(uploadActivityAtom, current => {
        const currentById = new Map(current.map(entry => [entry.id, entry]))
        return trimActivities([
          ...update.uploads.map(
            ({id, file, error}): Activity => ({
              id,
              type: 'upload',
              status: 'failed',
              error,
              startedAt: currentById.get(id)?.startedAt ?? Date.now(),
              finishedAt: Date.now(),
              upload: update.destination,
              operations: [
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
      })
      return
    }
    set(uploadActivityAtom, current =>
      current.filter(entry => !update.ids.includes(entry.id))
    )
  }
)

export function activityState(items: Array<Activity>): DashboardActivity {
  const latestFetch = items.find(activity => activity.type === 'fetch')
  const hasFailedFetch = latestFetch?.status === 'failed'
  const hasFailedMutations = items.some(
    activity => activity.type === 'mutation' && activity.status === 'failed'
  )
  const hasFailedUploads = items.some(
    activity => activity.type === 'upload' && activity.status === 'failed'
  )
  return {
    items,
    isFetchingUpdates: items.some(
      activity => activity.type === 'fetch' && activity.status === 'running'
    ),
    isMutating: items.some(
      activity =>
        activity.type !== 'fetch' &&
        (activity.status === 'pending' || activity.status === 'running')
    ),
    hasFailed: hasFailedMutations || hasFailedUploads || hasFailedFetch,
    hasFailedMutations,
    hasBlocked: items.some(activity => activity.status === 'blocked'),
    canRetry: hasFailedMutations || hasFailedFetch,
    canDiscard: hasFailedMutations || hasFailedUploads
  }
}

function trimActivities(activities: Array<Activity>) {
  return activities.slice(0, activityHistoryLimit)
}
