import type {ComponentType} from 'react'
import {Label} from './Label'
import {Root} from './Root'
import {Schema, TypesOf} from './Schema'
import {getRandomColor} from './util/GetRandomColor'

export type Workspaces = Record<string, Workspace>

export type Workspace<T = any> = {
  name: Label
  schema: Schema<T>
  source: string
  mediaDir?: string
  color: string
  roots: Record<string, Root<TypesOf<T>>>
  preview?: ComponentType<{entry: T; previewToken: string}>
}

export function workspace<T>(
  name: Label,
  options: Omit<Workspace<T>, 'name' | 'color'> & {color?: string}
): Workspace<T> {
  return {
    name,
    ...options,
    color: options.color || getRandomColor(JSON.stringify(name))
  }
}
