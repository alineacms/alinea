export interface EntryUrlConflictErrorInfo {
  url: string
  entryId: string
  workspace: string
  root: string
}

export class EntryUrlConflictError extends Error {
  name = 'EntryUrlConflictError'

  constructor(public info: EntryUrlConflictErrorInfo) {
    super(
      `URL "${info.url}" is already defined by entry ${info.entryId}. Remove or change this URL alias before publishing.`
    )
  }
}
