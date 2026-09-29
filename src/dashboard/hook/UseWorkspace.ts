import type {WorkspaceInternal} from '#/core/Workspace.js'
import {useDashboardContext} from '../hooks.js'

export interface DashboardWorkspace extends WorkspaceInternal {
  name: string
}

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 *
 * @deprecated Use `useEntry` from 'alinea/cms' for the workspace name of the current entry (`entry.workspace`).
 */
export function useWorkspace(): DashboardWorkspace {
  return useDashboardContext().workspace
}
