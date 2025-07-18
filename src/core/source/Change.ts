export type Change = AddChange | DeleteChange

export interface ChangeFile {
  path: string
  sha: string
}

export interface AddChange extends ChangeFile {
  op: 'add'
  contents?: Uint8Array
}

export interface DeleteChange extends ChangeFile {
  op: 'delete'
}

export interface ChangesBatch {
  fromSha: string
  changes: Array<Change>
}
