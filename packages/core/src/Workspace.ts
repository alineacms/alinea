import type {ComponentType} from 'react'
import {Label} from './Label'
import {Root} from './Root'
import {Schema, TypesOf} from './Schema'
import {getRandomColor} from './util/GetRandomColor'

/** A record of multiple named workspaces */
export type Workspaces = Record<string, Workspace>

/**
 * Use a workspace to divide content.
 * It is possible to create internal links between workspaces.
 **/
export type Workspace<T = any> = {
  /** The name of the workspace */
  name: Label
  /** The schema of the workspace */
  schema: Schema<T>
  /**
   * Points to a Data.Source either by passing a directory or a file.
   * - If the source is a directory, it will be scanned for files.
   * - If the source is a file, it will be evaluated.
   */
  source: string
  /** The directory where media files are placed in case a file backend is used */
  mediaDir?: string
  /** The main theme color used in the dashboard */
  color: string
  /** Todo: remove or document */
  roots: Record<string, Root<TypesOf<T>>>
  /** A react component used to preview an entry in the dashboard */
  preview?: ComponentType<{entry: T; previewToken: string}>
}

/** Create a workspace */
export function workspace<T>(
  name: Label,
  options: Omit<Workspace<T>, 'name' | 'color'> & {color?: string}
): Workspace<T> {
  return {
    ...options,
    name,
    color: options.color || getRandomColor(JSON.stringify(name))
  }
}
