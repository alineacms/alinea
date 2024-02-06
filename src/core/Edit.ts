import {File} from '@alinea/iso'
import {
  FieldOptions,
  ListEditor,
  ListField,
  ListRow,
  RichTextEditor,
  RichTextField,
  TextDoc
} from 'alinea/core'
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
    return new CreateOperation<Definition>(type)
  }

  export function remove(entryId: string) {
    return new DeleteOp(entryId)
  }

  export function upload(file: File, options?: UploadOptions) {
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
