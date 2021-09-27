import {Channel, Field, Label} from '@alinea/core'
import {LazyRecord} from '@alinea/core/util/LazyRecord'
import type {Array as YArray, Map as YMap} from 'yjs'

export type ListOptions = {
  of: LazyRecord<Channel>
  help?: Label
  inline?: boolean
  initialValue?: number
}

// Todo: keep shape of row in a bogus property so we can recontruct type
// from it later?
export type ListRow<T> = YMap<any>

export type ListField<T> = Field<YArray<ListRow<T>>> & {
  label: Label
  options: ListOptions
}

export function createList<T>(
  label: Label,
  options: ListOptions
): ListField<T> {
  return {
    label,
    options
  }
}
