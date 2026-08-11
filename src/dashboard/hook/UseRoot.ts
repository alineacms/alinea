import type {RootData} from '#/core/Root.js'
import {useAtomValue} from 'jotai'
import {useDashboardContext} from '../hooks.js'

export interface DashboardRoot extends RootData {
  name: string
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useRoot(): DashboardRoot {
  const {root} = useDashboardContext()
  return {name: root.key, ...useAtomValue(root.data)}
}
