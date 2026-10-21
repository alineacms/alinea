import * as cito from 'cito'
import type {ComponentType} from 'react'
import {type HasRoot, getRoot, hasRoot, internalRoot} from './Internal.js'
import type {Label} from './Label.js'
import type {OrderBy} from './OrderBy.js'
import {Overview, type OverviewOptions} from './Overview.js'
import type {Page} from './Page.js'
import type {Preview} from './Preview.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import type {View} from './View.js'

export interface RootI18n {
  /** The locales entries in this root are translated into, the first is the default */
  locales: ReadonlyArray<string>
  /**
   * How content is translated: `entries` (the default) keeps an entry per
   * locale, `fields` keeps a single entry whose `Field.localised` fields hold
   * a value per locale
   */
  translate?: 'entries' | 'fields'
  /**
   * Locales to try, in order, when a `Field.localised` value is empty for
   * the requested locale. It does not affect which entry version a query
   * returns: a root that translates entries stores a separate entry per
   * locale and a query for a locale without a translation returns nothing.
   */
  fallback?: (requested: string) => ReadonlyArray<string>
}

export interface RootMeta {
  /** Accepts entries of these types as children */
  contains?: Array<string | Type>
  /** How the dashboard lists the entries at the top level of this root */
  overview?: OverviewOptions
  /**
   * Order children entries in the sidebar content tree
   * @deprecated Use `overview.sort`
   */
  orderChildrenBy?: OrderBy | Array<OrderBy>
  /** Open this root when the workspace is opened without a specific root */
  openByDefault?: boolean
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
  /**
   * The i18n of a root that translates fields. Such a root keeps a single
   * entry per item, so its `i18n` is left out for everything that keeps an
   * entry per locale.
   */
  fieldI18n?: RootI18n
}

export type Root<Children extends ChildrenDefinition = ChildrenDefinition> =
  Children & HasRoot

export namespace Root {
  export function label(root: Root): Label {
    return getRoot(root).label
  }

  export function contains(root: Root): Array<string | Type> {
    return getRoot(root).contains ?? []
  }

  export function data(root: Root): RootData {
    return getRoot(root)
  }

  /** The locales the `Field.localised` fields of a root hold a value in */
  export function fieldI18n(root: RootData): RootI18n | undefined {
    return root.fieldI18n
  }

  /** @deprecated Use `Root.fieldI18n` */
  export const mediaI18n = fieldI18n

  export function preview(root: Root): Preview | undefined {
    return getRoot(root).preview
  }

  export function defaultLocale(root: Root): string | undefined {
    return getRoot(root).i18n?.locales[0]
  }

  /** The default order of children: `overview.sort`, or `orderChildrenBy` */
  export function childrenOrder(
    root: RootData
  ): OrderBy | Array<OrderBy> | undefined {
    return root.overview?.sort ?? root.orderChildrenBy
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
    openByDefault: cito.boolean.optional,
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
    const {view, overview} = data(root)
    return [
      ...(typeof view === 'string' ? [view] : []),
      ...Overview.referencedViews(overview)
    ]
  }
}

export interface RootOptions<Children> extends RootMeta {
  children?: Children
}

export interface RootInternal extends RootOptions<ChildrenDefinition> {
  label: string
  fieldI18n?: RootI18n
}

export function root<Entries extends ChildrenDefinition>(
  label: string,
  config: RootOptions<Entries> = {}
): Root<Entries> {
  const {i18n} = config
  const data: RootInternal =
    i18n?.translate === 'fields'
      ? {...config, label, i18n: undefined, fieldI18n: i18n}
      : {...config, label}
  const instance = <Root<Entries>>{
    ...config.children,
    [internalRoot]: data
  }
  return instance
}
