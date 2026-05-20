import {Root, type RootData} from '#/core/Root.js'
import {useAtomValue} from 'jotai'
import {useDashboard} from '../store.js'

export interface DashboardRoot extends RootData {
  name: string
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useRoot(): DashboardRoot {
  const dashboard = useDashboard()
  const config = useAtomValue(dashboard.config)
  const workspaceName = useAtomValue(dashboard.selectedWorkspace)
  const rootName = useAtomValue(dashboard.selectedRoot)
  if (!workspaceName) throw new Error('No workspace selected')
  if (!rootName) throw new Error('No root selected')
  const root = config.workspaces[workspaceName]?.[rootName]
  if (!root) throw new Error('No root found')
  return {name: rootName, ...Root.data(root)}
}
