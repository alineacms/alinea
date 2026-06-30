import {Workspace, type WorkspaceInternal} from '#/core/Workspace.js'
import {useAtomValue} from 'jotai'
import {useDashboard} from '../store.js'

export interface DashboardWorkspace extends WorkspaceInternal {
  name: string
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useWorkspace(): DashboardWorkspace {
  const dashboard = useDashboard()
  const config = useAtomValue(dashboard.config)
  const workspaceName = useAtomValue(dashboard.selectedWorkspace)
  if (!workspaceName) throw new Error('No workspace selected')
  const workspace = config.workspaces[workspaceName]
  if (!workspace) throw new Error('No workspace found')
  return {name: workspaceName, ...Workspace.data(workspace)}
}
