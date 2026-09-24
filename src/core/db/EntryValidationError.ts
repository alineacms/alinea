import {ErrorCode, HttpError} from '../HttpError.js'
import {
  type FieldValidationError,
  formatValidationErrors
} from '../Validation.js'

export interface EntryValidationErrorInfo {
  entryId: string
  title?: string
  errors: Array<FieldValidationError>
}

/** A published version would contain fields which fail validation */
export class EntryValidationError extends HttpError {
  name = 'EntryValidationError'

  constructor(public info: EntryValidationErrorInfo) {
    const entry = info.title
      ? `"${info.title}" (${info.entryId})`
      : `entry ${info.entryId}`
    super(
      ErrorCode.UnprocessableEntity,
      `Cannot publish ${entry}, fix these fields first:\n${formatValidationErrors(info.errors)}`
    )
  }
}
