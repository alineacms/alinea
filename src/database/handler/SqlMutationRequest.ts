import type {Config} from '#/core/Config.js'
import type {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {EntryTransaction} from '#/core/db/EntryTransaction.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import type {Database} from 'rado'
import {openCheckpoint, type CheckpointIdentity} from '../runtime/Checkpoint.js'
import {reconcileDatabase} from '../runtime/ReconcileDatabase.js'
import {SqlSource} from '../source/SqlSource.js'

/** Prepare a Graph mutation request using an exclusively owned writable SQL
 * connection. Intermediate SQL changes support sequential batch reads, but are
 * always rolled back. The source authority must still accept the returned
 * request against fromSha; preparing a request does not commit content or files.
 */
export async function sqlMutationRequest(
  config: Config,
  db: Database,
  identity: CheckpointIdentity,
  mutations: ReadonlyArray<Mutation>,
  policy: Policy,
  user?: User
): Promise<CommitRequest> {
  user = user ? structuredClone(user) : undefined
  const prepared = new Error('Roll back mutation preparation')
  let request: CommitRequest | undefined
  try {
    await db.transaction(
      async tx => {
        const {runtime, descriptor} = await openCheckpoint(config, tx, identity)
        const source = new SqlSource(tx, identity.namespace)
        const reader = {
          revision: descriptor.sourceSha,
          graph: runtime,
          async advance(batch: ChangesBatch) {
            const overlay = await OverlaySource.create(source)
            await overlay.applyChanges(batch)
            await reconcileDatabase(config, tx, overlay, identity)
            return (await openCheckpoint(config, tx, identity)).runtime
          }
        }
        const transaction = new EntryTransaction(
          config,
          reader,
          source,
          await source.getTree(),
          policy,
          user
        )
        await transaction.apply(mutations)
        request = await transaction.toRequest()
        throw prepared
      },
      {async: true}
    )
  } catch (error) {
    if (error !== prepared) throw error
  }
  if (!request)
    throw new Error('Mutation preparation did not produce a request')
  return request
}
