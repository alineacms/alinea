import {Root, type RootData} from '#/core/Root.js'
import {useAtomValue} from 'jotai'
import {
  configAtom,
  selectedRootAtom,
  selectedWorkspaceAtom
} from '../atoms/index.js'

export interface DashboardRoot extends RootData {
  name: string
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useRoot(): DashboardRoot {
  const config = useAtomValue(configAtom)
  const workspaceName = useAtomValue(selectedWorkspaceAtom)
  const rootName = useAtomValue(selectedRootAtom)
  if (!workspaceName) throw new Error('No workspace selected')
  if (!rootName) throw new Error('No root selected')
  const root = config.workspaces[workspaceName]?.[rootName]
  if (!root) throw new Error('No root found')
  return {name: rootName, ...Root.data(root)}
}
