import {EntryEditProps} from 'alinea/dashboard/view/EntryEdit'
import * as cito from 'cito'
import type {ComponentType} from 'react'
import {EntryStatus} from './EntryRow.js'
import {Expr} from './Expr.js'
import {Field} from './Field.js'
import {getType, hasType, HasType, internalType} from './Internal.js'
import {Label} from './Label.js'
import {SummaryProps} from './media/Summary.js'
import {OrderBy} from './OrderBy.js'
import {section, Section} from './Section.js'
import {RecordShape} from './shape/RecordShape.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {entries, fromEntries, keys, values} from './util/Objects.js'
import {Expand} from './util/Types.js'
import {View} from './View.js'

export interface EntryUrlMeta {
  status: EntryStatus
  path: string
  parentPaths: Array<string>
  locale?: string | null
}

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

  export function isHidden(type: Type): boolean {
    return Boolean(getType(type).hidden)
  }

  export function shape(type: Type): RecordShape {
    return getType(type).shape
  }

  export function searchableText(type: Type, value: any): string {
    return shape(type).searchableText(value).trim()
  }

  function fields(type: Type): Record<string, Field> {
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

  const TypeOptions = cito.object({
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

function fieldsOfDefinition(
  definition: FieldsDefinition
): Array<readonly [string, Field]> {
  return entries(definition).flatMap(([key, value]) => {
    if (Field.isField(value)) return [[key, value]] as const
    if (Section.isSection(value)) return entries(Section.fields(value))
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
  view?: View<EntryEditProps & {type: Type}>
  /** A React component used to view a row of this type in the dashboard */
  summaryRow?: View<SummaryProps>
  /** A React component used to view a thumbnail of this type in the dashboard */
  summaryThumb?: View<SummaryProps>

  entryUrl?: (meta: EntryUrlMeta) => string
}

export interface TypeInternal extends TypeConfig<FieldsDefinition> {
  label: string
  allFields: Record<string, Field>
  sections: Array<Section>
  shape: RecordShape
}

/** Create a new type */
export function type<Fields extends FieldsDefinition>(
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
  const instance = {
    ...allFields,
    [internalType]: {
      ...config,
      allFields,
      sections,
      shape: new RecordShape(
        label,
        fromEntries(
          fieldsOfDefinition(config.fields).map(([key, field]) => {
            return [key, Field.shape(field as Field)]
          })
        )
      ),
      label
    }
  }
  Type.validate(instance)
  return instance
}
