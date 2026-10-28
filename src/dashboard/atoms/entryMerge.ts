import {Field} from '#/core/Field.js'
import {ListFieldBase} from '#/core/field/ListField.js'
import {RecordField} from '#/core/field/RecordField.js'
import {RichTextField} from '#/core/field/RichTextField.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {LocalisedField} from '#/field/localiser/Localiser.js'
import {equal} from './ReactiveNode.js'

export type MergeChoice = 'merge' | 'yours' | 'theirs'

/** A field both editors changed */
export interface EntryMergeField {
  key: string
  label: string
  /** The field of the type, which renders the values */
  field?: Field
  /** Either yours or theirs, a field of rows or parts can also combine both */
  simple: boolean
  /** The value both editors started from */
  base: unknown
  yours: unknown
  theirs: unknown
  /** Where in the field both changed it */
  paths: Array<Array<string>>
}

export interface EntryMerge {
  /** Who saved the entry meanwhile, and when */
  name?: string
  date?: number
  /** Labels of the fields with their changes merged without conflict */
  merged: Array<string>
  fields: Array<EntryMergeField>
  /** The locale of the entry, picks the value of localised fields */
  locale: string | null
  /** Titles and previews of the entries the values link to, by id */
  links: ReadonlyMap<string, EntryMergeLink>
}

export interface EntryMergeLink {
  title: string
  preview?: string
}

export interface EntryMergeInput {
  type: Type
  loaded: Record<string, unknown>
  mine: Record<string, unknown>
  theirs: Record<string, unknown>
  conflicts: Array<Array<string>>
  locale: string | null
  links: ReadonlyMap<string, EntryMergeLink>
  name?: string
  date?: number
}

/** What the merge dialog shows of a merge with conflicts */
export function entryMerge({
  type,
  loaded,
  mine,
  theirs,
  conflicts,
  locale,
  links,
  name,
  date
}: EntryMergeInput): EntryMerge {
  const label = (key: string) => {
    const field = Type.field(type, key)
    return field ? Field.label(field) : key
  }
  const keys = Array.from(new Set(conflicts.map(path => path[0])))
  const fields = keys.map(key => ({
    key,
    label: label(key),
    field: Type.field(type, key),
    simple: !combines(Type.field(type, key)),
    base: loaded[key],
    yours: mine[key],
    theirs: theirs[key],
    paths: conflicts.filter(path => path[0] === key).map(path => path.slice(1))
  }))
  const merged = Object.keys(theirs)
    .filter(key => !keys.includes(key))
    .filter(
      key => !equal(unstamped(key, loaded[key]), unstamped(key, theirs[key]))
    )
    .map(label)
  return {name, date, merged, fields, locale, links}
}

/** Fields of rows, blocks or other fields merge their parts separately */
function combines(field: Field | undefined) {
  return (
    field instanceof ListFieldBase ||
    field instanceof RichTextField ||
    field instanceof RecordField ||
    field instanceof LocalisedField
  )
}

/** The ids of the entries the values of the fields link to */
export function linkedIds(
  type: Type,
  keys: Array<string>,
  values: Array<Record<string, unknown>>
): Array<string> {
  const ids = keys.flatMap(key => {
    const field = Type.field(type, key)
    if (!field) return []
    const label = Field.label(field)
    return values.flatMap(value =>
      Field.references(field, value[key], {path: [key], label, labels: [label]})
    )
  })
  return Array.from(new Set(ids.map(reference => reference.targetId)))
}

// Every save stamps who saved it in the metadata, which is not an edit
function unstamped(key: string, value: unknown) {
  if (key !== 'metadata' || !isRecord(value)) return value
  return {...value, updatedAt: undefined, updatedBy: undefined}
}
