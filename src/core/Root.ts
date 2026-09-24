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
   * Locales to try, in order, when a per-locale value is empty for the
   * requested locale. Used by `Config.media({i18n})` to pick the alt text of
   * images. It does not affect which entry version a query returns: content
   * roots store a separate entry per locale and a query for a locale without
   * a translation returns nothing.
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
}

interface RootMediaData {
  _media?: {i18n?: RootI18n}
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

  export function mediaI18n(root: RootData): RootI18n | undefined {
    return (root as RootData & RootMediaData)._media?.i18n
  }

  export function preview(root: Root): Preview | undefined {
    return getRoot(root).preview
  }

  export function defaultLocale(root: Root): string | undefined {
    return getRoot(root).i18n?.locales[0]
  }

  export function overview(root: Root): OverviewOptions | undefined {
    return getRoot(root).overview
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
