import {useAtomValue} from '../AtomHooks.js'
import {Workspace, type WorkspaceInternal} from '#/core/Workspace.js'
import {selectedWorkspaceAtom} from '../atoms/routing.js'
import {configAtom} from '../atoms/config.js'

export interface DashboardWorkspace extends WorkspaceInternal {
  name: string
}

export function useWorkspace(): DashboardWorkspace {
  const config = useAtomValue(configAtom)
  const workspaceName = useAtomValue(selectedWorkspaceAtom)
  if (!workspaceName) throw new Error('No workspace selected')
  const workspace = config.workspaces[workspaceName]
  if (!workspace) throw new Error('No workspace found')
  return {name: workspaceName, ...Workspace.data(workspace)}
}
