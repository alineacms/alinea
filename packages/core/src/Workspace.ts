import type {ComponentType} from 'react'
import {Label} from './Label'
import {Root, RootConfig} from './Root'
import {Schema, SchemaConfig} from './Schema'
import {getRandomColor} from './util/GetRandomColor'

/** A record of multiple named workspaces */
export type Workspaces = Record<string, WorkspaceConfig>

export type WorkspaceOptions<T = any> = {
  /** The schema of the workspace */
  schema: SchemaConfig<T>
  /**
   * Points to a Data.Source either by passing a directory or a file.
   * - If the source is a directory, it will be scanned for files.
   * - If the source is a file, it will be evaluated.
   */
  source: string
  roots: Record<string, RootConfig>
  /** Generated types will be placed in this namespace  */
  typeNamespace?: string
  /** The directory where media files are placed in case a file backend is used */
  mediaDir?: string
  /** The main theme color used in the dashboard */
  color?: string
  /** A react component used to preview an entry in the dashboard */
  preview?: ComponentType<{entry: T; previewToken: string}>
  icon?: ComponentType
}

export type WorkspaceConfig<T = any> = {
  label: Label
  options: WorkspaceOptions<T>
}

/**
 * Use a workspace to divide content.
 * It is possible to create internal links between workspaces.
 **/
export class Workspace<T = any> implements WorkspaceConfig<T> {
  label: Label
  options: WorkspaceOptions<T>
  roots: Record<string, Root>
  schema: Schema<T>

  constructor(public name: string, public config: WorkspaceConfig<T>) {
    this.label = config.label
    this.options = config.options
    this.roots = Object.fromEntries(
      Object.entries(this.options.roots).map(([rootKey, config]) => {
        return [rootKey, new Root(rootKey, name, config)]
      })
    )
    this.schema = this.options.schema.toSchema(this)
  }

  get typeNamespace() {
    return this.options.typeNamespace
  }

  get source(): string {
    return this.options.source
  }

  get mediaDir() {
    return this.options.mediaDir
  }

  get preview() {
    return this.options.preview
  }

  get color() {
    return this.options.color || getRandomColor(JSON.stringify(this.label))
  }

  get icon() {
    return this.options.icon
  }
}

/** Create a workspace */
export function workspace<T>(
  /** The name of the workspace */
  label: Label,
  options: WorkspaceOptions<T>
): WorkspaceConfig<T> {
  return {
    label,
    options
  }
}
