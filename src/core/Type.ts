import * as cito from 'cito'
import type {ComponentType} from 'react'
import type {EntryStatus} from './Entry.js'
import type {Expr} from './Expr.js'
import {Field, type FieldBeforeSaveContext} from './Field.js'
import {type HasType, getType, hasType, internalType} from './Internal.js'
import type {Label} from './Label.js'
import type {OrderBy} from './OrderBy.js'
import type {Preview} from './Preview.js'
import {Section, section} from './Section.js'
import type {View} from './View.js'
import type {EntryReferenceTarget} from './db/EntryReference.js'
import type {SummaryProps} from './media/Summary.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, fromEntries, keys, values} from './util/Objects.js'
import type {Expand} from './util/Types.js'

export interface EntryUrlMeta {
  status: EntryStatus
  path: string
  parentPaths: Array<string>
  locale?: string | null
  workspace: string
  root: string
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

  export function isHidden(type: Type): boolean {
    return Boolean(getType(type).hidden)
  }

  export function searchableText(type: Type, value: any): string {
    const self: Record<string, any> = value || {}
    let res = ''
    for (const [key, field] of entries(fields(type))) {
      res += Field.searchableText(field, self[key])
    }
    return res.trim()
  }

  export function references(
    type: Type,
    value: Record<string, unknown>,
    path: Array<string> = []
  ): Array<EntryReferenceTarget> {
    const self = value || {}
    return entries(fields(type)).flatMap(([key, field]) => {
      return Field.references(field, self[key], {
        path: [...path, key],
        label: Field.label(field)
      })
    })
  }

  export function fields(type: Type): Record<string, Field> {
    return getType(type).allFields
  }

  export function sections(type: Type) {
    return getType(type).sections
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
    value: Record<string, unknown>
  ): Record<string, unknown> {
    return mergeInitialValue(value, initialValue(type)) as Record<
      string,
      unknown
    >
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
    return next
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
    view: cito.string.optional,
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
    const {view, summaryRow, summaryThumb} = getType(type)
    return [
      view,
      summaryRow,
      summaryThumb,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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
  /** Accepts entries of these types as children */
  contains?: Array<string | Type>
  /** Order children entries in the sidebar content tree */
  orderChildrenBy?: OrderBy | Array<OrderBy>
  /** Entries do not show up in the sidebar content tree */
  hidden?: true
  /** An icon (React component) to represent this type in the dashboard */
  icon?: ComponentType

  /** A React component used to view an entry of this type in the dashboard */
  view?: View<{type: Type}>
  /** The default dashboard view for entries of this type */
  defaultView?: EntryDefaultView
  /** A React component used to view a row of this type in the dashboard */
  summaryRow?: View<SummaryProps>
  /** A React component used to view a thumbnail of this type in the dashboard */
  summaryThumb?: View<SummaryProps>

  /** The position where new children will be inserted */
  insertOrder?: 'first' | 'last' | 'free'

  entryUrl?: (meta: EntryUrlMeta) => string

  preview?: Preview
}

export interface TypeInternal extends TypeConfig<FieldsDefinition> {
  label: string
  allFields: Record<string, Field>
  sections: Array<Section>
}

/** Create a new type */
export function type<Fields extends FieldsDefinition>(
  label: string,
  config: TypeConfig<Fields>
): Type<Fields> {
  const instance = createType(label, config)
  Type.validate(instance)
  return instance
}

export function createType<Fields extends FieldsDefinition>(
  label: string,
  config: TypeConfig<Fields>
): Type<Fields> {
  const sections: Array<Section> = []
  let current: Record<string, Field> = {}
  const addCurrent = () => {
    if (keys(current).length > 0) sections.push(section({definition: current}))
    current = {}
  }
  const fields: Array<[string, Field]> = []
  if (typeof config.fields !== 'object') {
    throw new Error('Type fields must be an object')
  }
  for (const [key, value] of entries(config.fields)) {
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
  const allFields = fromEntries(fields) as Fields
  return {
    ...allFields,
    [internalType]: {
      ...config,
      allFields,
      sections,
      label
    }
  }
}
