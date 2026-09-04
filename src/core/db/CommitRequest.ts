import type {Change, ChangeFile, ChangesBatch} from '../source/Change.js'
import type {User} from '../User.js'
import type {RemoveFileMutation, UploadFileMutation} from './Mutation.js'

export interface AddContent extends ChangeFile {
  op: 'addContent'
  contents: string
}

export interface DeleteContent extends ChangeFile {
  op: 'deleteContent'
}

export type CommitChange =
  | AddContent
  | DeleteContent
  | UploadFileMutation
  | RemoveFileMutation

export function commitChanges(changes: Array<Change>): Array<CommitChange> {
  return changes.map(change => {
    switch (change.op) {
      case 'add':
        return {
          ...change,
          op: 'addContent' as const,
          contents: new TextDecoder().decode(change.contents)
        }
      case 'delete':
        return {
          ...change,
          op: 'deleteContent' as const
        }
    }
  })
}

export function sourceChanges(request: CommitRequest): ChangesBatch {
  return {
    fromSha: request.fromSha,
    changes: request.changes
      .filter(
        change => change.op === 'addContent' || change.op === 'deleteContent'
      )
      .map(change => {
        switch (change.op) {
          case 'deleteContent':
            return {
              ...change,
              op: 'delete'
            }
          case 'addContent':
            return {
              ...change,
              op: 'add' as const,
              contents: new TextEncoder().encode(change.contents)
            }
        }
      })
  }
}

export interface CommitRequest {
  description: string
  user?: User
  fromSha: string
  intoSha: string
  changes: Array<CommitChange>
}
