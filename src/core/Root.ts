import type {ComponentType} from 'react'
import {Label} from './Label.js'
import {Meta, StripMeta} from './Meta.js'
import {PageSeed} from './Page.js'
export interface RootI18n {
  locales: Array<string>
}

export interface RootMeta {
  contains?: Array<string>
  icon?: ComponentType
  i18n?: RootI18n
  /** A React component used to view this root in the dashboard */
  view?: ComponentType<{root: RootData}>
}

export interface RootDefinition {
  [key: string]: PageSeed
  [Meta]?: RootMeta
}

export interface RootData extends RootMeta {
  label: Label
}

type Seed = Record<string, PageSeed>

export type Root<Definition extends Seed = Seed> = Definition & {
  [Root.Data]: RootData
}

export namespace Root {
  export const Data = Symbol.for('@alinea/Root.Data')

  export function label(root: Root): Label {
    return root[Root.Data].label
  }

  export function data(root: Root): RootData {
    return root[Root.Data]
  }

  export function defaultLocale(root: Root): string | undefined {
    return root[Root.Data].i18n?.locales[0]
  }

  export function isRoot(value: any): value is Root {
    return Boolean(value && value[Root.Data])
  }
}

export function root<Definition extends RootDefinition>(
  label: Label,
  definition: Definition
): Root<StripMeta<Definition>> {
  return {
    ...definition,
    [Root.Data]: {
      label,
      ...definition[Meta]
    }
  }
}

export namespace root {
  export const meta: typeof Meta = Meta
}
