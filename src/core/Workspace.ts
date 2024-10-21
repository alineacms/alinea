import {Preview} from 'alinea/core/Preview'
import type {ComponentType} from 'react'
import {getWorkspace, HasWorkspace, internalWorkspace} from './Internal.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {getRandomColor} from './util/GetRandomColor.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, values} from './util/Objects.js'

export interface WorkspaceMeta {
  /** A directory which contains the json entry files */
  source: string
  /** The directory where media files are placed in case a file backend is used */
  mediaDir?: string
  /** The main theme color used in the dashboard */
  color?: string
  icon?: ComponentType
  preview?: Preview
}

type Roots = Record<string, Root>

export interface WorkspaceDefinition {
  [key: string]: Root
}

export type Workspace<Definition extends Roots = Roots> = Definition &
  HasWorkspace

export namespace Workspace {
  export const Data = Symbol.for('@alinea/Workspace.Data')
  export const Meta = Symbol.for('@alinea/Workspace.Meta')

  export function data(workspace: Workspace): WorkspaceInternal {
    return getWorkspace(workspace)
  }

  export function roots(workspace: Workspace): Roots {
    return getWorkspace(workspace).roots
  }

  export function label(workspace: Workspace): string {
    return getWorkspace(workspace).label
  }

  export function preview(workspace: Workspace): Preview | undefined {
    return getWorkspace(workspace).preview
  }

  export function isWorkspace(value: any): value is Workspace {
    return Boolean(value && value[Workspace.Data])
  }

  export function defaultMediaRoot(workspace: Workspace): string {
    const {roots} = getWorkspace(workspace)
    for (const [name, root] of entries(roots))
      if (Root.isMediaRoot(root)) return name
    throw new Error(`Workspace has no media root`)
  }

  export function defaultRoot(workspace: Workspace): string {
    return Object.keys(getWorkspace(workspace).roots)[0]
  }

  export function validate(workspace: Workspace, schema: Schema) {
    for (const [key, root] of entries(workspace)) {
      if (!isValidIdentifier(key))
        throw new Error(
          `Invalid Root name "${key}" in workspace "${label(
            workspace
          )}", use only a-z, A-Z, 0-9, and _`
        )
      Root.validate(root, label(workspace), schema)
    }
  }

  export function referencedViews(workspace: Workspace) {
    return values(roots(workspace)).flatMap(Root.referencedViews)
  }
}

export interface WorkspaceConfig<Definition> extends WorkspaceMeta {
  roots: Definition
}

export interface WorkspaceInternal
  extends WorkspaceConfig<WorkspaceDefinition> {
  label: string
  color: string
}

/** Create a workspace */
export function workspace<Definition extends WorkspaceDefinition>(
  /** The name of the workspace */
  label: string,
  config: WorkspaceConfig<Definition>
): Workspace<Definition> {
  const roots = config.roots
  return {
    ...roots,
    [internalWorkspace]: {
      ...config,
      label,
      color: config.color ?? getRandomColor(JSON.stringify(label))
    }
  }
}
