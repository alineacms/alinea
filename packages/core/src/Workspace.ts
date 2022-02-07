import {ComponentType} from 'react'
import {Label} from './Label'
import {Schema} from './Schema'

export type Workspaces = Record<string, Workspace>

export type Workspace<T = any> = {
  name: Label
  schema: Schema<T>
  contentDir: string
  mediaDir?: string
  color?: string
  preview?: ComponentType<T>
}

export function workspace<T>(
  name: Label,
  options: Omit<Workspace<T>, 'name'>
): Workspace<T> {
  return {name, ...options}
}
