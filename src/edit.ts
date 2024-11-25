import {Reference} from 'alinea/core/Reference'
import {TextDoc} from 'alinea/core/TextDoc'
import {
  CreateOperation,
  CreateQuery,
  DeleteOp,
  UpdateOperation,
  UpdateQuery,
  UploadOperation,
  UploadQuery
} from 'alinea/core/Transaction'
import {ListEditor, ListField} from 'alinea/core/field/ListField'
import {RichTextEditor, RichTextField} from 'alinea/core/field/RichTextField'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {LinkEditor, LinksEditor} from 'alinea/field/link/LinkEditor'
import {LinkField, LinksField} from 'alinea/field/link/LinkField'

export function update<Definition>(
  query: UpdateQuery<Definition>
): UpdateOperation<Definition> {
  return new UpdateOperation<Definition>(query)
}

export function create<Definition>(query: CreateQuery<Definition>) {
  return new CreateOperation<Definition>(query)
}

export function remove(...entryIds: Array<string>) {
  return new DeleteOp(entryIds)
}

export function upload(query: UploadQuery) {
  return new UploadOperation(query)
}

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
