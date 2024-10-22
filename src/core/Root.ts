import * as cito from 'cito'
import type {ComponentType} from 'react'
import {getRoot, HasRoot, internalRoot} from './Internal.js'
import {Label} from './Label.js'
import {PageSeed} from './Page.js'
import {Preview} from './Preview.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {View} from './View.js'

export interface RootI18n {
  locales: Array<string>
}

export interface RootMeta {
  contains?: Array<string | Type>
  icon?: ComponentType
  i18n?: RootI18n
  /** Point to a React component used to view this root in the dashboard */
  view?: View<{root: RootData}>
  isMediaRoot?: boolean
  preview?: Preview
}

export interface EntriesDefinition {
  [key: string]: PageSeed
}

export interface RootData extends RootMeta {
  label: string
}

export type Root<Entries extends EntriesDefinition = EntriesDefinition> =
  Entries & HasRoot

export namespace Root {
  export const Data = Symbol.for('@alinea/Root.Data')

  export function label(root: Root): Label {
    return getRoot(root).label
  }

  export function data(root: Root): RootData {
    return getRoot(root)
  }

  export function preview(root: Root): Preview | undefined {
    return getRoot(root).preview
  }

  export function defaultLocale(root: Root): string | undefined {
    return getRoot(root).i18n?.locales[0]
  }

  export function isRoot(value: any): value is Root {
    return Boolean(value && value[Root.Data])
  }

  export function isMediaRoot(root: Root): boolean {
    return Boolean(getRoot(root).isMediaRoot)
  }

  const RootOptions = cito.object({
    label: cito.string,
    i18n: cito.object({
      locales: cito.array(cito.string)
    }).optional,
    view: cito.string.optional,
    isMediaRoot: cito.boolean.optional
  })

  export function validate(root: Root, workspaceLabel: string, schema: Schema) {
    const {contains} = getRoot(root)
    const keyOfType = Schema.typeNames(schema)
    if (contains) {
      for (const inner of contains) {
        if (typeof inner === 'string') {
          if (!schema[inner])
            throw new Error(
              `Root "${label(
                root
              )}" in workspace "${workspaceLabel}" contains "${inner}", but that Type does not exist`
            )
        } else {
          const hasType = keyOfType.has(inner)
          if (!hasType)
            throw new Error(
              `Root "${label(
                root
              )}" in workspace "${workspaceLabel}" contains "${Type.label(
                inner
              )}", but that Type does not exist`
            )
        }
      }
    }
  }

  export function referencedViews(root: Root): Array<string> {
    const {view} = data(root)
    return typeof view === 'string' ? [view] : []
  }
}

export interface RootOptions<Entries> extends RootMeta {
  entries?: Entries
}

export interface RootInternal extends RootOptions<EntriesDefinition> {
  label: string
}

export function root<Entries extends EntriesDefinition>(
  label: string,
  config: RootOptions<Entries> = {}
): Root<Entries> {
  const instance = <Root<Entries>>{
    ...config.entries,
    [internalRoot]: {...config, label}
  }
  return instance
}
