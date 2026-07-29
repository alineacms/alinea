import type {Graph} from '#/core/Graph.js'
import {useGraph as useDashboardGraph} from '../hooks.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useGraph(): Graph {
  return useDashboardGraph()
}
