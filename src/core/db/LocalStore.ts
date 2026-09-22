import type {Policy} from '#/core/Role.js'
import type {RemoteSource, Source} from '#/core/source/Source.js'
import type {CommitRequest} from './CommitRequest.js'
import type {Mutation} from './Mutation.js'
import type {WriteableGraph} from './WriteableGraph.js'

export interface SyncOptions {
  /** Skip entry validation for a remote whose entries were already validated. */
  validate?: boolean
}

/**
 * A locally available entry store: a writeable graph backed by a source that
 * can be synced against a remote and committed to. Implemented by the SQLite
 * engine (`EntryStore`) and the `LocalDB` convenience facade.
 */
export interface LocalStore extends WriteableGraph, RemoteSource {
  source: Source
  sha: string | Promise<string>
  sync(): Promise<string>
  syncWith(remote: RemoteSource, options?: SyncOptions): Promise<string>
  includedAtBuild(filePath: string): boolean | Promise<boolean>
  request(
    mutations: ReadonlyArray<Mutation>,
    policy?: Policy
  ): Promise<CommitRequest>
  write(request: CommitRequest): Promise<{sha: string}>
}
