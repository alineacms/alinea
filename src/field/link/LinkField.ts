import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import type {Picker} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {Schema} from 'alinea/core/Schema'
import {ListField} from 'alinea/core/field/ListField'
import {UnionField} from 'alinea/core/field/UnionField'
import {ListRow} from 'alinea/core/shape/ListShape'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {ReactNode} from 'react'

/** Optional settings to configure a link field */
export interface LinkFieldOptions<Value> extends FieldOptions<Value> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  max?: number
}

export interface LinkOptions<Value> extends LinkFieldOptions<Value> {
  pickers: Record<string, Picker<any, any>>
}

export class LinkField<
  StoredValue extends Reference,
  QueryValue
> extends UnionField<StoredValue, QueryValue, LinkOptions<StoredValue>> {}

export function createLink<StoredValue extends Reference, QueryValue>(
  label: string,
  options: WithoutLabel<LinkOptions<StoredValue>>
): LinkField<StoredValue, QueryValue> {
  const pickers = entries(options.pickers)
  const schema: Schema = fromEntries(
    pickers
      .filter(([type, picker]) => picker.fields)
      .map(([type, picker]) => [type, picker.fields])
  )
  const shapes = fromEntries(
    pickers.map(([type, picker]) => [type, picker.shape])
  )
  return new LinkField(schema, shapes, {
    options: {label, ...options},
    async postProcess(value, loader) {
      const type = value[Reference.type]
      const picker = options.pickers[type]
      if (!picker) return
      if (picker.postProcess) await picker.postProcess(value, loader)
    },
    view: 'alinea/field/link/LinkField.view#SingleLinkInput'
  })
}

/** Internal representation of a link field */
export class LinksField<
  StoredValue extends ListRow,
  QueryValue
> extends ListField<StoredValue, QueryValue, LinkOptions<Array<StoredValue>>> {}

/** Create a link field configuration */
export function createLinks<StoredValue extends ListRow, QueryValue>(
  label: string,
  options: WithoutLabel<LinkOptions<Array<StoredValue>>>
): LinksField<StoredValue, QueryValue> {
  const pickers = entries(options.pickers)
  const schema: Schema = fromEntries(
    pickers
      .filter(([type, picker]) => picker.fields)
      .map(([type, picker]) => [type, picker.fields])
  )
  const shapes = fromEntries(
    pickers.map(([type, picker]) => [type, picker.shape])
  )
  return new LinksField(schema, shapes, {
    options: {label, ...options},
    async postProcess(rows, loader) {
      const tasks = []
      for (const row of rows) {
        const type = row[ListRow.type]
        const picker = options.pickers[type]
        if (!picker) return
        if (picker.postProcess) tasks.push(picker.postProcess(row, loader))
      }
      await Promise.all(tasks)
    },
    view: 'alinea/field/link/LinkField.view#MultipleLinksInput'
  })
}
