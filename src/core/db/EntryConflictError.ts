import {HttpError} from '../HttpError.js'

export interface EntryConflictErrorInfo {
  entryId: string
  locale: string | null
  /** The file hash of the version saved meanwhile */
  fileHash: string
}

/** An entry was saved over a version other than the one the editor loaded */
export class EntryConflictError extends HttpError {
  name = 'EntryConflictError'

  constructor(public info: EntryConflictErrorInfo) {
    super(409, `Entry ${info.entryId} changed since it was loaded`)
  }
}

/** Errors passed from a worker keep their name, not their class */
export function isEntryConflict(error: unknown): boolean {
  return error instanceof Error && error.name === 'EntryConflictError'
}
