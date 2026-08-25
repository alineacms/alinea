import type {Config} from '#/core/Config.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {EntryTransaction} from '#/core/db/EntryTransaction.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Policy} from '#/core/Role.js'
import type {Source} from '#/core/source/Source.js'
import {SourceEntryDatabase} from '../entry/Source.js'
import {SnapshotTransactionIndex} from '../entry/TransactionIndex.js'

export async function requestSourceMutations(
  config: Config,
  source: Source,
  mutations: ReadonlyArray<Mutation>,
  policy?: Policy
): Promise<CommitRequest> {
  const database = await SourceEntryDatabase.load(config, source)
  const transaction = new EntryTransaction(
    config,
    new SnapshotTransactionIndex(database.snapshot),
    source,
    database.tree,
    policy
  )
  transaction.apply([...mutations])
  return transaction.toRequest()
}
