import type {ComponentType} from 'react'
import {CMS} from './CMS.js'
import {Label} from './Label.js'
import {Meta} from './Meta.js'
import {PageSeed} from './Page.js'

export interface RootI18n {
  locales: Array<string>
}

export interface RootMeta {
  contains: Array<string>
  icon?: ComponentType
  i18n?: RootI18n
}

export interface RootDefinition {
  [key: string]: PageSeed
  [Meta]: RootMeta
}

export interface RootData extends RootMeta {
  label: Label
}

export type Root<Definition = {}> = Definition & {
  [Root.Data]: RootData
  [CMS.Link]?: CMS
}

export namespace Root {
  export const Data = Symbol.for('@alinea/Root.Data')

  export function label(root: Root): Label {
    return root[Root.Data].label
  }

  export function data(root: Root): RootData {
    return root[Root.Data]
  }

  export function defaultLocale(
    i18n: RootI18n | Root | undefined
  ): string | undefined {
    if (i18n === undefined) return undefined
    if ('locales' in i18n) return i18n?.locales[0]
    return i18n[Root.Data].i18n?.locales[0]
  }
}

export function root<Definition extends RootDefinition>(
  label: Label,
  definition: Definition
): Root<Definition> {
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
