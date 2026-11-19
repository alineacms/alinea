import {atom} from 'jotai'
import {type ActivitySource, isUnsettled} from '../boot/ActivityEvent.js'
import {VersionEvent} from '../boot/VersionEvent.js'
import {activityAtom} from './activity.js'
import {eventsAtom, graphAtom} from './core.js'
import {routeGuardAtom} from './nav.js'
import type {ReactiveNode} from './ReactiveNode.js'

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

/** The editor of the entry that is open, set by its page. */
export interface OpenEdits {
  entryId: string
  locale: string | null
  node: ReactiveNode<object>
}

export const openEditsAtom = atom<OpenEdits | null>(null)

/** Unsaved changes of an entry, kept over a reload for an update. */
export interface KeptEdits {
  entryId: string
  locale: string | null
  /** The saved value the changes started from */
  checkpoint: object
  edited: object
}

const keptEditsKey = 'alinea-edits-kept-for-update'

/**
 * The changes the page kept before it reloaded, read once when it loads.
 * They live in the session storage of the tab: other tabs do not see them,
 * and they are gone with the tab.
 */
function takeKeptEdits(): KeptEdits | undefined {
  try {
    const stored = sessionStorage.getItem(keptEditsKey)
    sessionStorage.removeItem(keptEditsKey)
    return stored ? (JSON.parse(stored) as KeptEdits) : undefined
  } catch {
    return undefined
  }
}

/** Edits kept over a reload, until the editor of their entry takes them. */
export const keptEditsAtom = atom<KeptEdits | undefined>(takeKeptEdits())

/**
 * Keep the unsaved changes of the open entry for after a reload. Returns
 * whether nothing unsaved is lost: false when the changes could not be
 * stored.
 */
export const keepEditsAtom = atom(null, (get): boolean => {
  const open = get(openEditsAtom)
  if (!open || !get(open.node.isDirty)) return true
  const kept: KeptEdits = {
    entryId: open.entryId,
    locale: open.locale,
    checkpoint: get(open.node.checkpoint),
    edited: get(open.node.value)
  }
  try {
    sessionStorage.setItem(keptEditsKey, JSON.stringify(kept))
    return true
  } catch {
    return false
  }
})

/**
 * Whether a reload loses nothing: no change or upload that is not committed
 * yet. Unsaved changes of the open entry are kept over the reload, see
 * `keepEditsAtom`. A failed sync does not count, a reload is what resolves
 * the sync of an outdated dashboard. Asks the worker, so activities a tab has
 * not heard of yet count too.
 */
export const canReloadSafelyAtom = atom(null, async (get): Promise<boolean> => {
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
