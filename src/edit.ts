import type {Reference} from 'alinea/core/Reference'
import type {TextDoc} from 'alinea/core/TextDoc'
import {ListEditor, type ListField} from 'alinea/core/field/ListField'
import {
  RichTextEditor,
  type RichTextField
} from 'alinea/core/field/RichTextField'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {LinkEditor, LinksEditor} from 'alinea/field/link/LinkEditor'
import type {LinkField, LinksField} from 'alinea/field/link/LinkField'

export {
  update,
  create,
  upload,
  move,
  publish,
  archive,
  remove
} from 'alinea/core/db/Operation'

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
