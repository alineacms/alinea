import type {CommitApi, SyncApi} from '../Connection.js'
import type {AddChange, DeleteChange} from '../source/Change.js'
import type {ReadonlyTree} from '../source/Tree.js'
import type {LocalDB} from './LocalDB.js'
import type {RemoveFileMutation, UploadFileMutation} from './Mutation.js'

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

export async function attemptCommit(
  local: LocalDB,
  remote: CommitApi & SyncApi,
  request: CommitRequest
): Promise<void> {
  const sourceChanges = request.changes
    .filter(change => change.op === 'addContent' || change.op === 'delete')
    .map(change => {
      if (change.op === 'addContent')
        return {
          ...change,
          op: 'add' as const,
          contents: new TextEncoder().encode(change.contents)
        }
      return change
    })
  await local.indexChanges(sourceChanges)
  try {
    const sha = await remote.commit(request)
    if (sha === request.intoSha) {
      await local.applyChanges(sourceChanges)
      return
    }
  } finally {
    await local.syncWith(remote)
  }
}
