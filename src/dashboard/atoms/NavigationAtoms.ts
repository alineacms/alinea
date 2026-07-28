import {atom} from 'jotai'
import {requiredAtom} from './AtomUtils.js'
import type {PreparedRoute} from './loaders/Route.js'
import type {Navigation} from './navigation/Navigation.js'

export const navigationAtom = requiredAtom<Navigation<PreparedRoute>>(
  'dashboard.navigation'
)

export const navigationAtoms: Navigation<PreparedRoute> = {
  route: atom(
    get => get(get(navigationAtom).route),
    (get, set, update) => set(get(navigationAtom).route, update)
  ),
  prepared: atom(
    get => get(get(navigationAtom).prepared),
    (get, set, prepared) => set(get(navigationAtom).prepared, prepared)
  ),
  refresh: atom(null, (get, set, route, prepared) =>
    set(get(navigationAtom).refresh, route, prepared)
  ),
  pending: atom(get => get(get(navigationAtom).pending)),
  error: atom(get => get(get(navigationAtom).error))
}

export const routeAtom = navigationAtoms.route
