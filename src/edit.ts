import type {Reference} from '#/core/Reference.js'
import type {TextDoc} from '#/core/TextDoc.js'
import {ListEditor, type ListField} from '#/core/field/ListField.js'
import {RichTextEditor, type RichTextField} from '#/core/field/RichTextField.js'
import type {ListRow} from '#/core/ListRow.js'
import {LinkEditor, LinksEditor} from '#/field/link/LinkEditor.js'
import type {LinkField, LinksField} from '#/field/link/LinkField.js'

export {
  update,
  create,
  upload,
  move,
  publish,
  archive,
  remove
} from '#/core/db/Operation.js'

export function list<StoredValue extends ListRow, QueryValue extends ListRow>(
  field: ListField<StoredValue, QueryValue, any>,
  current?: Array<StoredValue>
) {
  return new ListEditor<StoredValue>(current)
}

export function richText<Blocks = unknown>(
  field?: RichTextField<Blocks, any>,
  current?: TextDoc<Blocks>
) {
  return new RichTextEditor<Blocks>(current)
}

export function link<StoredValue extends Reference, QueryValue>(
  field: LinkField<StoredValue, QueryValue>
) {
  return new LinkEditor<StoredValue>()
}

export function links<StoredValue extends ListRow, QueryValue>(
  field: LinksField<StoredValue, QueryValue>
) {
  return new LinksEditor<StoredValue>()
}
