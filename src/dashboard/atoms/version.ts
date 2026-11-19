import {atom} from 'jotai'
import {VersionEvent} from '../boot/VersionEvent.js'
import {activityAtom} from './activity.js'
import {eventsAtom, graphAtom} from './core.js'
import {routeGuardAtom} from './nav.js'

interface VersionSource {
  outdated(): Promise<boolean>
}

const outdatedValueAtom = atom(false)

/**
 * A newer dashboard was deployed: the handler runs another config and
 * refuses changes from this one until it is reloaded.
 */
export const dashboardOutdatedAtom = Object.assign(
  atom(
    get => get(outdatedValueAtom),
    (get, set) => {
      const events = get(eventsAtom)
      const source = get(graphAtom) as object & Partial<VersionSource>
      let active = true
      const listen = (event: Event) => {
        if (event instanceof VersionEvent && event.outdated)
          set(outdatedValueAtom, true)
      }
      events.addEventListener(VersionEvent.type, listen)
      // A tab that connects to a worker which already knows
      void source.outdated?.().then(
        outdated => {
          if (active && outdated) set(outdatedValueAtom, true)
        },
        () => {}
      )
      return () => {
        active = false
        events.removeEventListener(VersionEvent.type, listen)
      }
    }
  ),
  {onMount: (initialize: () => void) => initialize()}
)

/** Whether the open entry has changes that are not saved yet. */
export const hasUnsavedChangesAtom = atom(get => {
  const guard = get(routeGuardAtom)
  return guard ? get(guard) : false
})

/**
 * Whether a reload loses nothing: no unsaved changes, and no change or upload
 * waiting to be committed. A failed sync does not count, a reload is what
 * resolves the sync of an outdated dashboard.
 */
export const canReloadSafelyAtom = atom(get => {
  if (get(hasUnsavedChangesAtom)) return false
  return !get(activityAtom).items.some(
    activity =>
      activity.type !== 'sync' &&
      (activity.status === 'pending' ||
        activity.status === 'running' ||
        activity.status === 'blocked' ||
        activity.status === 'failed')
  )
})
