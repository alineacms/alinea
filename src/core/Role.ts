import type {Graph} from './Graph.js'
import type {HasRoot} from './Internal.js'

export interface Permission {
  canCreate?: boolean
  canRead?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canPublish?: boolean
  canArchive?: boolean
  canReorder?: boolean
  canMove?: boolean
  canUpload?: boolean
}

export type Location = {
  workspace: string
  root: string
  parentId?: string
  lanaguage?: string
}

export interface RoleOptions {
  description?: string
  showRoots?: Array<HasRoot>
  showLanguages?: Array<string>
  permissions(graph: Graph): Promise<Array<Permission>>
}

export function role(label: string, config: RoleOptions) {}
