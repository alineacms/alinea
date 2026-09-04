import type {Config} from '#/core/Config.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {EntryTransaction} from '#/core/db/EntryTransaction.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Policy} from '#/core/Role.js'
import type {Source} from '#/core/source/Source.js'
import type {EntryStore} from '../entry/Store.js'
import {DatabaseResolver} from '../query/Resolver.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'

/** Builds source commits through the same lazy graph used for reads. */
export async function requestRuntimeSourceMutations(
  config: Config,
  source: Source,
  store: EntryStore,
  index: RuntimeDatabaseIndex,
  mutations: ReadonlyArray<Mutation>,
  policy?: Policy
): Promise<CommitRequest> {
  const tree = await source.getTree()
  const transaction = new EntryTransaction(
    config,
    index.revision,
    new DatabaseResolver(config, store),
    source,
    tree,
    policy
  )
  await transaction.apply([...mutations])
  return transaction.toRequest()
}
