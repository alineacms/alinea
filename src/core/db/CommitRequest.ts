import type {CommitApi, SyncApi} from '../Connection.js'
import type {Change, ChangeFile} from '../source/Change.js'
import type {ReadonlyTree} from '../source/Tree.js'
import type {LocalDB} from './LocalDB.js'
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

export function sourceChanges(changes: Array<CommitChange>): Array<Change> {
  return changes
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

export async function attemptCommit(
  local: LocalDB,
  remote: CommitApi & SyncApi,
  request: CommitRequest
): Promise<void> {
  const contentChanges = sourceChanges(request.changes)
  await local.indexChanges(contentChanges)
  try {
    const {sha} = await remote.commit(request)
    if (sha === request.intoSha) {
      await local.applyChanges(contentChanges)
      return
    }
  } finally {
    await local.syncWith(remote)
  }
}
