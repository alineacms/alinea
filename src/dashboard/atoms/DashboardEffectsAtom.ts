import {IndexEvent} from '#/core/db/IndexEvent.js'
import {atom} from 'jotai'
import {eventsAtom} from './CoreAtoms.js'
import {routeAtom} from './NavigationAtoms.js'
import {reloadPageAtom} from './PageAtoms.js'
import {entryRevisionAtom} from './RevisionAtom.js'

export const dashboardEffectsAtom = Object.assign(
  atom(
    () => undefined,
    (get, set) => {
      const events = get(eventsAtom)
      const listen = (event: Event) => {
        if (!(event instanceof IndexEvent) || event.data.op !== 'entry')
          return
        const id = event.data.id
        set(entryRevisionAtom(id), current => current + 1)
        if (get(routeAtom).entry === id) void set(reloadPageAtom)
      }
      events.addEventListener(IndexEvent.type, listen)
      return () => {
        events.removeEventListener(IndexEvent.type, listen)
      }
    }
  ),
  {
    onMount(start: () => () => void) {
      return start()
    }
  }
)
