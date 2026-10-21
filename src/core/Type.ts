import type {EntryActionProps} from './DashboardEntry.js'
import * as cito from 'cito'
import type {ComponentType} from 'react'
import type {Config} from './Config.js'
import type {EntryStatus} from './Entry.js'
import type {Expr} from './Expr.js'
import {
  Field,
  type EntryAnchorTarget,
  type FieldAnchorContext,
  type FieldInitialContext,
  type FieldLocalizeContext,
  type FieldBeforeSaveContext
} from './Field.js'
import {type HasType, getType, hasType, internalType} from './Internal.js'
import type {Label} from './Label.js'
import type {OrderBy} from './OrderBy.js'
import {Overview, type OverviewOptions} from './Overview.js'
import type {Preview} from './Preview.js'
import {Section, section} from './Section.js'
import type {View} from './View.js'
import type {EntryReferenceTarget} from './db/EntryReference.js'
import type {SummaryProps} from './media/Summary.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, fromEntries, isRecord, keys, values} from './util/Objects.js'
import type {Expand, UnionToIntersection} from './util/Types.js'

export interface EntryUrlInput {
  config: Config
  data: Record<string, unknown>
  status: EntryStatus
  path: string
  parentPaths: Array<string>
  locale?: string | null
  workspace: string
  root: string
}

export interface EntryUrlMeta extends EntryUrlInput {
  defaultUrl: string
}

export type EntryDefaultView = 'edit' | 'overview'

export type Type<Definition = object> = Definition & HasType

type TypeRow<Definition> = Expand<{
  [K in keyof Definition as Definition[K] extends Expr<any>
    ? K
    : never]: Definition[K] extends Expr<infer T> ? T : never
}>
export namespace Type {
  export type Infer<Definition> = TypeRow<Definition>

  export function label(type: Type): Label {
    return getType(type).label
  }
  export function contains(type: Type): Array<string | Type> {
    return getType(type).contains ?? []
  }
  export function insertOrder(type: Type): 'first' | 'last' | 'free' {
    return getType(type).insertOrder ?? 'free'
  }

  export function overview(type: Type): OverviewOptions | undefined {
    return getType(type).overview
  }

  /** The default order of children: `overview.sort`, or `orderChildrenBy` */
  export function childrenOrder(
    type: Type
  ): OrderBy | Array<OrderBy> | undefined {
    const {overview, orderChildrenBy} = getType(type)
    return overview?.sort ?? orderChildrenBy
  }

  export function isHidden(type: Type): boolean {
    return Boolean(getType(type).hidden)
  }

  export function isCollapsed(type: Type): boolean {
    return getType(type).collapsed === true
  }

  export function expands(type: Type): boolean {
    return getType(type).collapsed === false
  }

  export function searchableText(type: Type, value: any): string {
    const self: Record<string, any> = value || {}
    let res = ''
    for (const [key, field] of entries(fields(type))) {
      res += Field.searchableText(field, self[key])
    }
    return res.trim()
  }

  export function anchors(
    type: Type,
    value: Record<string, unknown>,
    path: Array<string> = [],
    labels: Array<string> = []
  ): Array<EntryAnchorTarget> {
    const self = value || {}
    return entries(fields(type)).flatMap(([key, field]) => {
      const label = Field.label(field)
      return Field.anchors(field, self[key], {
        path: [...path, key],
        label,
        labels: [...labels, label]
      })
    })
  }

  export function references(
    type: Type,
    value: Record<string, unknown>,
    path: Array<string> = [],
    labels: Array<string> = []
  ): Array<EntryReferenceTarget> {
    const self = value || {}
    return entries(fields(type)).flatMap(([key, field]) => {
      const label = Field.label(field)
      return Field.references(field, self[key], {
        path: [...path, key],
        label,
        labels: [...labels, label]
      })
    })
  }

  export function fields(type: Type): Record<string, Field> {
    return getType(type).allFields
  }

  export function sections(type: Type) {
    return getType(type).sections
  }

  /** The tabs of the type, see `TypeConfig.tabs` */
  export function tabs(type: Type): Record<string, Type> | undefined {
    const {tabs} = getType(type)
    return tabs && keys(tabs).length > 0 ? tabs : undefined
  }

  export function isContainer(type: Type) {
    return Boolean(getType(type).contains)
  }

  export function field(type: Type, name: string): Field | undefined {
    return getType(type).allFields[name]
  }

  export function isType(type: any): type is Type {
    return Boolean(type && hasType(type))
  }

  export function sharedData(type: Type, entryData: Record<string, unknown>) {
    const res: Record<string, unknown> = {}
    for (const [key, field] of entries(fields(type))) {
      if (Field.options(field).shared) res[key] = entryData[key]
    }
    if (keys(res).length === 0) return undefined
    return res
  }

  export function initialValue(type: Type) {
    const res: Record<string, unknown> = {}
    for (const [key, field] of entries(fields(type))) {
      res[key] = Field.initialValue(field)
    }
    return res
  }

  export function withInitialValue(
    type: Type,
    value: Record<string, unknown>,
    context?: FieldInitialContext
  ): Record<string, unknown> {
    const merged = mergeInitialValue(value, initialValue(type)) as Record<
      string,
      unknown
    >
    let next = merged
    for (const [key, field] of entries(fields(type))) {
      const before = merged[key]
      const after = Field.withInitialValue(field, before, context)
      if (after === before) continue
      if (next === merged) next = {...merged}
      next[key] = after
    }
    return normalizeAnchors(type, next)
  }

  export function normalizeAnchors(
    type: Type,
    value: Record<string, unknown>,
    context: FieldAnchorContext = {anchors: new Set()}
  ): Record<string, unknown> {
    let next = value
    for (const [key, field] of entries(fields(type))) {
      const before = next[key]
      const after = Field.normalizeAnchors(field, before, context)
      if (after === before) continue
      if (next === value) next = {...value}
      next[key] = after
    }
    return next
  }

  export function localizeLinks(
    type: Type,
    value: Record<string, unknown>,
    context: FieldLocalizeContext
  ): Record<string, unknown> {
    let next = value
    for (const [key, field] of entries(fields(type))) {
      const before = next[key]
      const after = Field.localizeLinks(field, before, context)
      if (after === before) continue
      if (next === value) next = {...value}
      next[key] = after
    }
    return next
  }

  export function beforeSave(
    type: Type,
    value: Record<string, unknown>,
    context: Omit<FieldBeforeSaveContext<unknown>, 'value'>
  ): Record<string, unknown> {
    let next = value
    for (const [key, field] of entries(fields(type))) {
      const before = next[key]
      const after = Field.beforeSave(field, before, context)
      if (after === before) continue
      if (next === value) next = {...value}
      next[key] = after
    }
    return normalizeAnchors(type, next)
  }

  export async function applyLinks(
    type: Type,
    value: Record<string, unknown>,
    loader: import('./db/LinkResolver.js').LinkResolver
  ): Promise<void> {
    const self = value || {}
    await Promise.all(
      entries(fields(type)).map(([key, field]) => {
        return Field.applyLinks(field, self[key], loader)
      })
    )
  }

  export function preview(type: Type): Preview | undefined {
    return getType(type).preview
  }

  export function defaultView(type: Type): EntryDefaultView | undefined {
    return getType(type).defaultView
  }

  const TypeOptions = cito.object({
    defaultView: cito.string.optional,
    view: cito.union(cito.string, cito.instance(Function)).optional,
    summaryRow: cito.string.optional,
    summaryThumb: cito.string.optional
  })

  export function validate(type: Type) {
    TypeOptions(getType(type))
    for (const [key, field] of entries(fields(type))) {
      if (!isValidIdentifier(key))
        throw new Error(
          `Invalid field name "${key}" in Type "${label(
            type
          )}", must match [A-Za-z][A-Za-z0-9_]*`
        )
    }
  }

  export function referencedViews(type: Type): Array<string> {
    const {view, summaryRow, summaryThumb, overview, actions} = getType(type)
    return [
      view,
      summaryRow,
      summaryThumb,
      ...(actions ?? []),
      ...Overview.referencedViews(overview),
      ...viewsOfDefinition(getType(type).fields)
    ].filter(v => typeof v === 'string')
  }
}

function mergeInitialValue(value: unknown, initialValue: unknown): unknown {
  if (!isRecord(initialValue)) return value
  if (!isRecord(value)) return initialValue
  let next = value
  for (const [key, initialChildValue] of entries(initialValue)) {
    const childValue = value[key]
    const child = mergeInitialValue(childValue, initialChildValue)
    if (child !== childValue) {
      if (next === value) next = {...value}
      next[key] = child
    } else if (childValue === undefined) {
      if (next === value) next = {...value}
      next[key] = initialChildValue
    }
  }
  return next
}

function viewsOfDefinition(definition: FieldsDefinition): Array<string> {
  return values(definition).flatMap(value => {
    if (Field.isField(value)) return Field.referencedViews(value)
    if (Section.isSection(value))
      return Section.referencedViews(value).concat(
        viewsOfDefinition(Section.fields(value))
      )
    return []
  })
}

export interface FieldsDefinition {
  [key: string]: Field
}

export interface TypeConfig<Definition> {
  fields: Definition
  /**
   * Tabs next to the fields, eg.
   * `{analytics: Field.tab('Analytics', {view: '@/views/Analytics'})}`.
   * Entries show them in the entry editor, list rows and rich text blocks in
   * their settings sheet. The fields of a tab are stored and queried like the
   * other fields.
   */
  tabs?: Record<string, Type>
  /** Accepts entries of these types as children */
  contains?: Array<string | Type>
  /** How the dashboard lists the children of entries of this type */
  overview?: OverviewOptions
  /**
   * Components rendered in the header of the entry editor, next to the
   * publish button, eg. a button that exports or sends the entry. They can
   * read the fields of the entry with the hooks of `alinea/cms`.
   */
  actions?: Array<View<EntryActionProps>>
  /**
   * Order children entries in the sidebar content tree
   * @deprecated Use `overview.sort`
   */
  orderChildrenBy?: OrderBy | Array<OrderBy>
  /** Entries do not show up in the sidebar content tree */
  hidden?: true
  /**
   * How entries show their children in the sidebar content tree. By default
   * they expand when the entry is opened. With `true` they stay collapsed
   * until the arrow is clicked, useful for entries with many children that
   * are browsed in their overview instead. With `false` they are expanded
   * from the start.
   */
  collapsed?: boolean
  /** An icon (React component) to represent this type in the dashboard */
  icon?: ComponentType

  /**
   * A React component, or a path to one, that replaces the form of entries of
   * this type below the entry header. It edits the fields of the entry with
   * the hooks of `alinea/cms`.
   */
  view?: View<{type: Type}>
  /** The default dashboard view for entries of this type */
  defaultView?: EntryDefaultView
  /**
   * A React component used to view a row of this type in the dashboard
   * @deprecated Not used by the dashboard, configure the columns of the
   * parent's overview with `overview.columns`
   */
  summaryRow?: View<SummaryProps>
  /**
   * A React component used to view a thumbnail of this type in the dashboard
   * @deprecated Not used by the dashboard, configure the card image of the
   * parent's overview with `overview.thumbnail`
   */
  summaryThumb?: View<SummaryProps>

  /** The position where new children will be inserted */
  insertOrder?: 'first' | 'last' | 'free'

  entryUrl?: (meta: EntryUrlMeta) => string

  preview?: Preview
}

/** Types that only hold children can leave out their fields */
export interface ContainerTypeConfig<Definition> extends Omit<
  TypeConfig<Definition>,
  'fields' | 'contains'
> {
  fields?: Definition
  /** Accepts entries of these types as children */
  contains: Array<string | Type>
}

export interface TypeInternal extends TypeConfig<FieldsDefinition> {
  label: string
  allFields: Record<string, Field>
  sections: Array<Section>
}

/** Create a new type */
/** The fields of the tabs of a type, see `TypeConfig.tabs` */
export type TabFields<Tabs> = [keyof Tabs] extends [never]
  ? {}
  : UnionToIntersection<
      {[K in keyof Tabs]: Tabs[K] extends Type<infer F> ? F : never}[keyof Tabs]
    >

export function type<
  Fields extends FieldsDefinition = {},
  Tabs extends Record<string, Type> = {}
>(
  label: string,
  config: (TypeConfig<Fields> | ContainerTypeConfig<Fields>) & {tabs?: Tabs}
): Type<Fields & TabFields<Tabs>> {
  const instance = createType(label, config)
  Type.validate(instance)
  return instance as Type<Fields & TabFields<Tabs>>
}

export function createType<Fields extends FieldsDefinition = {}>(
  label: string,
  {
    fields: definition = {} as Fields,
    ...config
  }: TypeConfig<Fields> | ContainerTypeConfig<Fields>
): Type<Fields> {
  const sections: Array<Section> = []
  let current: Record<string, Field> = {}
  const addCurrent = () => {
    if (keys(current).length > 0) sections.push(section({definition: current}))
    current = {}
  }
  const fields: Array<[string, Field]> = []
  if (typeof definition !== 'object') {
    throw new Error('Type fields must be an object')
  }
  for (const [key, value] of entries(definition)) {
    if (Field.isField(value)) {
      current[key] = value
      fields.push([key, value])
    } else if (Section.isSection(value)) {
      addCurrent()
      sections.push(value)
      for (const [key, field] of entries(Section.fields(value))) {
        fields.push([key, field])
      }
    }
  }
  addCurrent()
  // Tabs are stored with the other fields, but left out of the sections that
  // make up the form
  const taken = new Set(fields.map(([key]) => key))
  const tabFields = values(config.tabs ?? {}).flatMap(tab =>
    entries(Type.fields(tab))
  )
  for (const [key, value] of tabFields) {
    const own = Section.isSection(value)
      ? entries(Section.fields(value))
      : Field.isField(value)
        ? [[key, value] as [string, Field]]
        : []
    for (const [name, field] of own) {
      if (taken.has(name))
        throw new Error(`Field "${name}" is defined twice in Type "${label}"`)
      taken.add(name)
      fields.push([name, field])
    }
  }
  const allFields = fromEntries(fields) as Fields
  return {
    ...allFields,
    [internalType]: {
      ...config,
      fields: definition,
      allFields,
      sections,
      label
    }
  }
}
