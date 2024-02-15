import {File} from '@alinea/iso'

import {ListEditor, ListField} from 'alinea/core/field/ListField'
import {RichTextEditor, RichTextField} from 'alinea/core/field/RichTextField'
import type {ListRow} from 'alinea/core/shape/ListShape'
import type {Entry} from './Entry.js'
import {FieldOptions} from './Field.js'
import {TextDoc} from './TextDoc.js'
import {
  CreateOperation,
  DeleteOp,
  EditOperation,
  UploadOperation,
  UploadOptions
} from './Transaction.js'
import {Type} from './Type.js'

export function Edit<Definition>(entryId: string, type?: Type<Definition>) {
  return new EditOperation<Definition>(entryId)
}

export namespace Edit {
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
    return Edit(entryId).archive()
  }

  export function publish(entryId: string) {
    return Edit(entryId).publish()
  }

  export function list<
    Row extends ListRow,
    Options extends FieldOptions<Array<Row>>
  >(field: ListField<Row, Options>, current?: Array<Row>) {
    return new ListEditor<Row>(current)
  }

  export function richText<Blocks>(
    field: RichTextField<Blocks, any>,
    current?: TextDoc<Blocks>
  ) {
    return new RichTextEditor<Blocks>(current)
  }
}
