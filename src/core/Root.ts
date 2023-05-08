import {Selection} from 'alinea/core/pages/Selection'
import type {ComponentType} from 'react'
import {CMS} from './CMS.js'
import {Connection} from './Connection.js'
import {Label} from './Label.js'

export interface RootI18n {
  locales: Array<string>
}

export interface RootMeta {
  contains: Array<string>
  icon?: ComponentType
  i18n?: RootI18n
}

export interface RootData extends RootMeta {
  label: Label
}

export interface Root {
  [Root.Data]: RootData
  [CMS.Link]?: CMS
}

export class Root {
  constructor(data: RootData) {
    this[Root.Data] = data
  }

  async fetch<S>(select: S): Promise<Selection.Infer<S>> {
    const cms = CMS.instanceFor(this)
    const cnx = await Connection.establish()
    return cnx.fetch(select)
  }

  async fetchOne<S>(select: S): Promise<Selection.Infer<S>> {
    const cnx = await Connection.establish()
    return cnx.fetch(select)
  }
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

export function root(label: Label, meta: RootMeta): Root {
  return new Root({label, ...meta})
}
