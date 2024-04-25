import {File} from '@alinea/iso'
import {LinkEditor, LinksEditor} from 'alinea/field/link/LinkEditor'
import {LinkField, LinksField} from 'alinea/field/link/LinkField'
import type {Entry} from './Entry.js'
import {Reference} from './Reference.js'
import {TextDoc} from './TextDoc.js'
import {
  CreateOperation,
  DeleteOp,
  EditOperation,
  UploadOperation,
  UploadOptions
} from './Transaction.js'
import {Type} from './Type.js'
import {ListEditor, ListField} from './field/ListField.js'
import {RichTextEditor, RichTextField} from './field/RichTextField.js'
import type {ListRow} from './shape/ListShape'

export function update<Definition>(entryId: string, type?: Type<Definition>) {
  return new EditOperation<Definition>(entryId)
}

export function create<Definition>(type: Type<Definition>) {
  return new CreateOperation<Definition>({}, type)
}

export function createEntry(entry: Entry) {
  return new CreateOperation(entry)
}

export function remove(entryId: string) {
  return new DeleteOp(entryId)
}

export function upload(
  file: File | [string, Uint8Array],
  options?: UploadOptions
) {
  return new UploadOperation(file, options)
}

export function archive(entryId: string) {
  return update(entryId).archive()
}

export function publish(entryId: string) {
  return update(entryId).publish()
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
