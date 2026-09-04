import type {FieldTransaction, FieldTransactionResult} from './Operations.js'
import type {ReplicaCommand, ReplicaCommandResult} from './Commands.js'
import type {PolicyData} from '#/core/Role.js'
import type {ReplicaState, Revision, ViewId} from './Types.js'

export interface ReplicaUser {
  id: string
  roles: ReadonlyArray<string>
}

export interface ReplicaBootstrap {
  user: ReplicaUser
  viewId: ViewId
  configId: string
  configUrl: string
  cacheKey: string
  /** Handler-evaluated ACL. Clients never execute role callbacks. */
  policy: PolicyData
}

export interface ReplicaCursor {
  revision: Revision
  viewId: ViewId
}

/**
 * Authenticated client transport. Authentication is intentionally implicit in
 * the transport (for example, an HTTP-only session cookie) rather than included
 * in replica payloads.
 */
export interface ReplicaTransport {
  bootstrap(): Promise<ReplicaBootstrap>

  state(
    cursor?: ReplicaCursor,
    signal?: AbortSignal
  ): Promise<ReplicaState | undefined>

  mutate(
    transaction: FieldTransaction,
    signal?: AbortSignal
  ): Promise<FieldTransactionResult>

  command(
    commands: ReadonlyArray<ReplicaCommand>,
    signal?: AbortSignal
  ): Promise<ReplicaCommandResult>
}
