import type {AddChange, DeleteChange} from '../Change.ts'
import type {ReadonlyTree} from '../Tree.ts'
import type {RemoveFileMutation, UploadFileMutation} from './Mutation.ts'

export type CommitChange =
  | AddChange
  | DeleteChange
  | UploadFileMutation
  | RemoveFileMutation

export interface CommitRequest {
  description: string
  fromSha: string
  intoSha: string
  checks: Array<[path: string, sha: string]>
  changes: Array<CommitChange>
}

export function checkCommit(tree: ReadonlyTree, request: CommitRequest): void {
  // If we have the same tree, we're good to go
  if (tree.sha === request.fromSha) return

  // If not, run checks
  for (const [path, sha] of request.checks) {
    const entry = tree.get(path)
    if (!entry) throw new Error(`Missing entry for ${path}`)
    if (entry.sha !== sha) throw new Error(`Entry ${path} has changed`)
  }
}
