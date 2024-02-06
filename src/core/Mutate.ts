import {File} from '@alinea/iso'
import {
  CreateOperation,
  DeleteOp,
  EditOperation,
  UploadOperation,
  UploadOptions
} from './Transaction.js'
import {Type} from './Type.js'

export namespace Mutate {
  export function edit<Definition>(entryId: string, type?: Type<Definition>) {
    return new EditOperation<Definition>(entryId)
  }

  export function create<Definition>(type: Type<Definition>) {
    return new CreateOperation<Definition>(type)
  }

  export function remove(entryId: string) {
    return new DeleteOp(entryId)
  }

  export function upload(file: File, options?: UploadOptions) {
    return new UploadOperation(file, options)
  }
}
