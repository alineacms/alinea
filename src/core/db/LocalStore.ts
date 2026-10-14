import type {Policy} from '#/core/Role.js'
import type {RemoteSource, Source} from '#/core/source/Source.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import type {CommitRequest} from './CommitRequest.js'
import type {Mutation} from './Mutation.js'
import type {WriteableGraph} from './WriteableGraph.js'

export interface SyncOptions {
  /** Skip entry validation for a remote whose entries were already validated. */
  validate?: boolean
  /** Called as files arrive from the remote, once there are files to fetch. */
  onProgress?(progress: SyncProgress): void
}

/** Files fetched from the remote during a sync. */
export interface SyncProgress {
  loaded: number
  total: number
}

/**
 * A locally available entry store: a writeable graph backed by a source that
 * can be synced against a remote and committed to. Implemented by the SQLite
 * engine (`EntryStore`) and the `LocalDB` convenience facade.
 */
export interface LocalStore extends WriteableGraph, RemoteSource {
  source: Source
  /** How the store reads its database, when it is a SQLite connection. */
  driver?: 'native' | 'overlay' | 'wasm'
  sha: string | Promise<string>
  sync(): Promise<string>
  syncWith(remote: RemoteSource, options?: SyncOptions): Promise<string>
  includedAtBuild(filePath: string): boolean | Promise<boolean>
  /** The source tree at `sha`, when this store had it recently. */
  treeAt(sha: string): Promise<ReadonlyTree | undefined>
  request(
    mutations: ReadonlyArray<Mutation>,
    policy?: Policy
  ): Promise<CommitRequest>
  write(request: CommitRequest): Promise<{sha: string}>
}
