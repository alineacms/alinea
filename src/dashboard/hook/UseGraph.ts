import type {Graph} from 'alinea/core/Graph'
import {useAtomValue} from 'jotai'
import {useDashboard} from '../store.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useGraph(): Graph {
  const dashboard = useDashboard()
  return useAtomValue(dashboard.db)
}
