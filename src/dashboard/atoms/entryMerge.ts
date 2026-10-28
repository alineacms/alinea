import {Field} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {equal} from './ReactiveNode.js'

export type MergeChoice = 'merge' | 'yours' | 'theirs'

/** A field both editors changed */
export interface EntryMergeField {
  key: string
  label: string
  /** A single value: either yours or theirs, a nested one can also merge */
  simple: boolean
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
}

export interface EntryMergeInput {
  type: Type
  loaded: Record<string, unknown>
  mine: Record<string, unknown>
  theirs: Record<string, unknown>
  conflicts: Array<Array<string>>
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
    simple: !isNested(mine[key]) && !isNested(theirs[key]),
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
  return {name, date, merged, fields}
}

function isNested(value: unknown) {
  return typeof value === 'object' && value !== null
}

// Every save stamps who saved it in the metadata, which is not an edit
function unstamped(key: string, value: unknown) {
  if (key !== 'metadata' || !isRecord(value)) return value
  return {...value, updatedAt: undefined, updatedBy: undefined}
}
