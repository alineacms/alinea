import {Workspace} from '@alinea/core'
import {useCurrentDraft} from '@alinea/editor'
import {useDashboard} from './UseDashboard'

export function useWorkspace(): Workspace & {workspace: string} {
  const {config} = useDashboard()
  const draft = useCurrentDraft()
  const workspace = draft?.workspace || Object.keys(config.workspaces)[0]
  return {workspace, ...config.workspaces[workspace]}
}
