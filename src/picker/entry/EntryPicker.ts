import type {EntryFields} from '#/core/EntryFields.js'
import type {Filter} from '#/core/Filter.js'
import type {Graph, Projection} from '#/core/Graph.js'
import type {Label} from '#/core/Label.js'
import type {Picker} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {Type, type} from '#/core/Type.js'
import {ListRow} from '#/core/shape/ListShape.js'
import {RecordShape} from '#/core/shape/RecordShape.js'
import {ScalarShape} from '#/core/shape/ScalarShape.js'
import {assign, keys} from '#/core/util/Objects.js'
import {selectLinkedLocalisedValue} from '#/field/localiser.js'
import {EntryReference} from './EntryReference.js'

export const unresolvedEntryMarker = Symbol('unresolvedEntryMarker')

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
      if (!entryId) {
        row[unresolvedEntryMarker] = true
        return
      }
      const linkIds = [entryId]
      if (!options.selection) return
      const [extra] = await loader.resolveLinks(options.selection, linkIds)
      if (!extra) {
        row[unresolvedEntryMarker] = true
        return
      }
      if (type !== 'image') return assign(row, extra)
      const {src: location, previewUrl, filePath, alt, root, workspace, ...rest} =
        extra
      const selectedAlt = selectLinkedLocalisedValue({
        value: alt as string | Record<string, string>,
        loader,
        workspace,
        root
      })
      if (!previewUrl) {
        assign(row, rest, {src: location})
        if (typeof selectedAlt === 'string') row.alt = selectedAlt
        return
      }
      // If the DB was built with this entry in it we can assume the location
      // is ready to use, otherwise use the preview url
      const locationAvailable = loader.includedAtBuild(filePath)
      const src = locationAvailable ? location : previewUrl
      row.src = src
      if (typeof selectedAlt === 'string') row.alt = selectedAlt
      assign(row, rest)
    }
  }
}
