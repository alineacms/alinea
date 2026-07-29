import {Workspace, type WorkspaceInternal} from '#/core/Workspace.js'
import {useAtomValue} from 'jotai'
import {configAtom, selectedWorkspaceAtom} from '../atoms/index.js'

export interface DashboardWorkspace extends WorkspaceInternal {
  name: string
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useWorkspace(): DashboardWorkspace {
  const config = useAtomValue(configAtom)
  const workspaceName = useAtomValue(selectedWorkspaceAtom)
  if (!workspaceName) throw new Error('No workspace selected')
  const workspace = config.workspaces[workspaceName]
  if (!workspace) throw new Error('No workspace found')
  return {name: workspaceName, ...Workspace.data(workspace)}
}
