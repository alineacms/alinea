import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Picker} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {Type, type} from 'alinea/core/Type'
import type {Condition} from 'alinea/core/pages/Expr'
import {Projection} from 'alinea/core/pages/Projection'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {assign} from 'alinea/core/util/Objects'
import {EntryReference} from './EntryReference.js'

export interface EntryPickerOptions<Definition = {}> {
  hint: Hint
  selection: Projection
  defaultView?: 'row' | 'thumb'
  location?: {workspace: string; root: string}
  condition?: Condition
  withNavigation?: boolean
  showMedia?: boolean
  max?: number
  label?: string
  title?: Label
  fields?: Definition | Type<Definition>
}

export function entryPicker<Ref extends EntryReference, Fields>(
  options: EntryPickerOptions<Fields>
): Picker<Ref, EntryPickerOptions<Fields>> {
  const fieldType = Type.isType(options.fields)
    ? options.fields
    : options.fields && type({fields: options.fields as any})
  const extra = fieldType && Type.shape(fieldType)
  return {
    shape: new RecordShape('Entry', {
      [Reference.id]: new ScalarShape('Id'),
      [Reference.type]: new ScalarShape('Type'),
      [EntryReference.entry]: new ScalarShape('Entry')
    }).concat(extra),
    hint: fieldType
      ? Hint.Intersection(options.hint, Type.hint(fieldType))
      : options.hint,
    fields: fieldType,
    label: options.label || 'Page link',
    handlesMultiple: true,
    options,
    async postProcess(row: any, loader) {
      const {
        [Reference.id]: id,
        [Reference.type]: type,
        [EntryReference.entry]: entryId,
        ...fields
      } = row as EntryReference
      for (const key of Object.keys(fields)) delete row[key]
      row.id = entryId
      row.fields = fields
      if (!entryId) return
      const linkIds = [entryId]
      if (!options.selection) return
      const [extra] = await loader.resolveLinks(options.selection, linkIds)
      assign(row, extra)
    }
  }
}
