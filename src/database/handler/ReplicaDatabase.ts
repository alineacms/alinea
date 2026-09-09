import type {HandlerDatabase} from '#/backend/Handler.js'
import type {Config} from '#/core/Config.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {EntryReferenceQuery} from '#/core/db/EntryReference.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {WritableGraph} from '#/core/db/WritableGraph.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {Policy} from '#/core/Role.js'
import type {RemoteSource} from '#/core/source/Source.js'
import type {NodeReplica} from '../driver/NodeReplica.js'

/** Handler Graph backed by a replica. Only the remote source can accept writes;
 * write() acknowledges those accepted changes in the local cache.
 */
export class ReplicaDatabase extends WritableGraph implements HandlerDatabase {
  constructor(readonly replica: NodeReplica) {
    super()
  }

  get config(): Config {
    return this.replica.config
  }
  get sha() {
    return this.replica.revision
  }
  get source() {
    return this.replica
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.replica.resolve(query)
  }

  resolvePreview<Query extends GraphQuery>(
    query: Query,
    remote: RemoteSource
  ): Promise<AnyQueryResult<Query>> {
    return this.replica.resolvePreview(query, remote)
  }

  referencesTo(query: EntryReferenceQuery) {
    return this.replica.referencesTo(query)
  }

  getTreeIfDifferent(sha: string) {
    return this.replica.getTreeIfDifferent(sha)
  }

  async syncWith(remote: RemoteSource) {
    await this.replica.sync(remote)
    return this.sha
  }

  request(mutations: ReadonlyArray<Mutation>, policy = Policy.ALLOW_ALL) {
    return this.replica.request(mutations, policy)
  }

  write(request: CommitRequest) {
    return this.replica.acceptCommit(request)
  }

  async mutate(_mutations: Array<Mutation>): Promise<{sha: string}> {
    throw new Error('Replica mutations must be committed by the remote source')
  }

  async prepareUpload(): Promise<never> {
    throw new Error('Replica uploads must be handled by the remote source')
  }
}
