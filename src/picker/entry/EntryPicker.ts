import {EntryFields} from 'alinea/core/EntryFields'
import {Filter} from 'alinea/core/Filter'
import {Graph, Projection} from 'alinea/core/Graph'
import {Label} from 'alinea/core/Label'
import {Picker} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {ListRow} from 'alinea/core/shape/ListShape'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {Type, type} from 'alinea/core/Type'
import {assign, keys} from 'alinea/core/util/Objects'
import {EntryReference} from './EntryReference.js'

export interface EditorInfo {
  graph: Graph
  entry: {
    id: string
    type: string
    workspace: string
    root: string
    parentId: string | null
    locale: string | null
  }
}

export interface EditorLocation {
  parentId?: string
  workspace: string
  root: string
}

type DynamicOption<T> = T | ((info: EditorInfo) => T | Promise<T>)

export interface EntryPickerConditions {
  /** Choose from a flat list of direct children of the currently edited entry */
  pickChildren?: boolean
  /** Set the initial location in which the entry picker is opened */
  location?: DynamicOption<EditorLocation>
  /** Filter entries by a condition, this results in a flat list of options */
  condition?: DynamicOption<Filter<EntryFields>>
  /** @internal Enable entry picker navigation */
  enableNavigation?: boolean
}

export interface EntryPickerOptions<Definition = {}>
  extends EntryPickerConditions {
  selection: Projection
  defaultView?: 'row' | 'thumb'
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
    : options.fields && type('Entry fields', {fields: options.fields as any})
  const extra = fieldType && Type.shape(fieldType)
  return {
    shape: new RecordShape('Entry', {
      [Reference.id]: new ScalarShape('Id'),
      [Reference.type]: new ScalarShape('Type'),
      [EntryReference.entry]: new ScalarShape('Entry')
    }).concat(extra),
    fields: fieldType,
    label: options.label || 'Page link',
    handlesMultiple: true,
    options,
    async postProcess(row: any, loader) {
      const {
        [Reference.id]: id,
        [Reference.type]: type,
        [EntryReference.entry]: entryId,
        [ListRow.index]: index,
        ...fields
      } = row as EntryReference & ListRow
      for (const key of keys(fields)) delete row[key]
      row.fields = fields
      if (!entryId) return
      const linkIds = [entryId]
      if (!options.selection) return
      const [extra] = await loader.resolveLinks(options.selection, linkIds)
      assign(row, extra)
    }
  }
}
