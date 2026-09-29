import type {RootData} from '#/core/Root.js'
import {useAtomValueRaw} from 'jotai'
import {useDashboardContext} from '../hooks.js'

export interface DashboardRoot extends RootData {
  name: string
}

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 *
 * @deprecated Use `useEntry` from 'alinea/cms' for the root name of the current entry (`entry.root`).
 */
export function useRoot(): DashboardRoot {
  const {root} = useDashboardContext()
  return {name: root.key, ...useAtomValueRaw(root.data)}
}
