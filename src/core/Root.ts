import * as cito from 'cito'
import type {ComponentType} from 'react'
import {getRoot, hasRoot, type HasRoot, internalRoot} from './Internal.js'
import type {Label} from './Label.js'
import type {OrderBy} from './OrderBy.js'
import type {Page} from './Page.js'
import type {Preview} from './Preview.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import type {View} from './View.js'

export interface RootI18n {
  locales: ReadonlyArray<string>
}

export interface RootMeta {
  /** Accepts entries of these types as children */
  contains?: Array<string | Type>
  /** Order children entries in the sidebar content tree */
  orderChildrenBy?: OrderBy | Array<OrderBy>
  icon?: ComponentType
  i18n?: RootI18n
  /** Point to a React component used to view this root in the dashboard */
  view?: View<{root: RootData}>
  isMediaRoot?: boolean
  preview?: Preview
}

export interface ChildrenDefinition {
  [key: string]: Page
}

export interface RootData extends RootMeta {
  label: string
}

export type Root<Children extends ChildrenDefinition = ChildrenDefinition> =
  Children & HasRoot

export namespace Root {
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

  export function localeName(root: Root, name: string): string | undefined {
    const {i18n} = getRoot(root)
    if (!i18n) return
    for (const locale of i18n.locales) {
      if (locale.toLowerCase() === name.toLowerCase()) return locale
    }
  }

  export function isRoot(value: any): value is Root {
    return Boolean(value && hasRoot(value))
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

export interface RootOptions<Children> extends RootMeta {
  children?: Children
}

export interface RootInternal extends RootOptions<ChildrenDefinition> {
  label: string
}

export function root<Entries extends ChildrenDefinition>(
  label: string,
  config: RootOptions<Entries> = {}
): Root<Entries> {
  const instance = <Root<Entries>>{
    ...config.children,
    [internalRoot]: {...config, label}
  }
  return instance
}
