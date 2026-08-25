import type {FieldTransaction, FieldTransactionResult} from './Operations.js'
import type {ReplicaState, Revision} from './Types.js'

export interface ReplicaUser {
  id: string
  roles: ReadonlyArray<string>
}

export interface ReplicaBootstrap {
  user: ReplicaUser
  configId: string
  configUrl: string
  cacheKey: string
}

/**
 * Authenticated client transport. Authentication is intentionally implicit in
 * the transport (for example, an HTTP-only session cookie) rather than included
 * in replica payloads.
 */
export interface ReplicaTransport {
  bootstrap(): Promise<ReplicaBootstrap>

  state(
    knownRevision?: Revision,
    signal?: AbortSignal
  ): Promise<ReplicaState | undefined>

  mutate(
    transaction: FieldTransaction,
    signal?: AbortSignal
  ): Promise<FieldTransactionResult>
}
