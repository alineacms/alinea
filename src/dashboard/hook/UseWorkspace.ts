import type {WorkspaceInternal} from '#/core/Workspace.js'
import {useDashboardContext} from '../hooks.js'

export interface DashboardWorkspace extends WorkspaceInternal {
  name: string
}

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useWorkspace(): DashboardWorkspace {
  return useDashboardContext().workspace
}
