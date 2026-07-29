import type {Graph} from '#/core/Graph.js'
import {useGraph as useDashboardGraph} from '../hooks.js'

export function useGraph(): Graph {
  return useDashboardGraph()
}
