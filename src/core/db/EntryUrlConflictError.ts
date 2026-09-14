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
      `URL "${info.url}" is already defined by entry ${info.entryId} in workspace "${info.workspace}", root "${info.root}". Change the entry path or remove this URL alias before publishing.`
    )
  }
}
