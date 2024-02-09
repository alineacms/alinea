import type {ComponentType} from 'react'
import {Label} from './Label.js'
import {Meta, StripMeta} from './Meta.js'
import {Root} from './Root.js'
import {isMediaRoot} from './media/MediaRoot.js'
import {getRandomColor} from './util/GetRandomColor.js'
import {entries} from './util/Objects.js'

export interface WorkspaceMeta {
  /** A directory which contains the json entry files */
  source: string
  /** The directory where media files are placed in case a file backend is used */
  mediaDir?: string
  /** The main theme color used in the dashboard */
  color?: string
  icon?: ComponentType
}

export interface WorkspaceData extends WorkspaceMeta {
  label: Label
  roots: Roots
  color: string
}

type Roots = Record<string, Root>

export interface WorkspaceDefinition {
  [key: string]: Root
  [Meta]?: WorkspaceMeta
}

export type Workspace<Definition extends Roots = Roots> = Definition & {
  [Workspace.Data]: WorkspaceData
}

export namespace Workspace {
  export const Data = Symbol.for('@alinea/Workspace.Data')
  export const Meta = Symbol.for('@alinea/Workspace.Meta')

  export function data(workspace: Workspace): WorkspaceData {
    return workspace[Workspace.Data]
  }

  export function roots(workspace: Workspace): Roots {
    return workspace[Workspace.Data].roots
  }

  export function label(workspace: Workspace): Label {
    return workspace[Workspace.Data].label
  }

  export function isWorkspace(value: any): value is Workspace {
    return Boolean(value && value[Workspace.Data])
  }

  export function defaultMediaRoot(workspace: Workspace): string {
    const {roots} = workspace[Workspace.Data]
    for (const [name, root] of entries(roots))
      if (isMediaRoot(root)) return name
    throw new Error(`Workspace ${workspace.name} has no media root`)
  }
}

export interface WorkspaceOptions<Definition> extends WorkspaceMeta {
  roots: Definition
}

/** Create a workspace */
export function workspace<Definition extends WorkspaceDefinition>(
  /** The name of the workspace */
  label: Label,
  definition: WorkspaceOptions<Definition>
): Workspace<Definition>
/** @deprecated See https://github.com/alineacms/alinea/issues/373 */
export function workspace<Definition extends WorkspaceDefinition>(
  /** The name of the workspace */
  label: Label,
  definition: Definition
): Workspace<StripMeta<Definition>>
export function workspace<Definition extends WorkspaceDefinition>(
  /** The name of the workspace */
  label: Label,
  definition: WorkspaceOptions<Definition> | Definition
) {
  const isOptions = 'roots' in definition && !Root.isRoot(definition.roots)
  const def: any = definition
  const roots = isOptions ? def.roots : def
  const options: WorkspaceMeta = (isOptions ? def : def[Meta]) ?? {}
  return {
    ...roots,
    [Workspace.Data]: {
      label,
      roots,
      ...options,
      color: options.color ?? getRandomColor(JSON.stringify(label))
    }
  }
}

export namespace workspace {
  export const meta: typeof Meta = Meta
}
