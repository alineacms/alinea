import type {Config} from '#/core/Config.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {EntryTransaction} from '#/core/db/EntryTransaction.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Policy} from '#/core/Role.js'
import type {Source} from '#/core/source/Source.js'
import type {EntryStore} from '../entry/Store.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import {loadTransactionPayloads} from '../runtime/TransactionPayloads.js'

/** Builds source commits from the runtime index with mutation-scoped payloads. */
export async function requestRuntimeSourceMutations(
  config: Config,
  source: Source,
  store: EntryStore,
  index: RuntimeDatabaseIndex,
  mutations: ReadonlyArray<Mutation>,
  policy?: Policy
): Promise<CommitRequest> {
  const tree = await source.getTree()
  const loaded = await loadTransactionPayloads(index, store, mutations)
  const transaction = new EntryTransaction(
    config,
    index.revision,
    index.entries,
    loaded,
    source,
    tree,
    policy
  )
  transaction.apply([...mutations])
  return transaction.toRequest()
}
