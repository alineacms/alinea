import {atom} from 'jotai'
import {type ActivitySource, isUnsettled} from '../boot/ActivityEvent.js'
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
 * that is not committed yet. A failed sync does not count, a reload is what
 * resolves the sync of an outdated dashboard. Asks the worker, so activities
 * a tab has not heard of yet count too.
 */
export const canReloadSafelyAtom = atom(null, async (get): Promise<boolean> => {
  if (get(hasUnsavedChangesAtom)) return false
  const source = get(graphAtom) as object & Partial<ActivitySource>
  // Uploads run in this tab, changes in the worker
  const activities = [
    ...get(activityAtom).items,
    ...((await source.activities?.()) ?? [])
  ]
  return !activities.some(
    activity => activity.type !== 'sync' && isUnsettled(activity)
  )
})
