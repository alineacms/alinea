import type {Graph} from '#/core/Graph.js'
import {useAtomValue} from 'jotai'
import {useDashboard} from '../store.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useGraph(): Graph {
  const dashboard = useDashboard()
  return useAtomValue(dashboard.db)
}
