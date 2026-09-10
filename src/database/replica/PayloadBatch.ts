import type {ReplicaIdentity} from '../browser/ReplicaCache.js'
import type {LoadedPayload, PayloadRequest} from '../runtime/EntryRuntime.js'

export interface PayloadBatchRequest {
  identity: ReplicaIdentity
  revision: string
  requests: Array<PayloadRequest>
}

/** Authenticated, non-cacheable payload envelope. */
export interface PayloadBatch {
  version: 1
  identity: ReplicaIdentity
  revision: string
  payloads: Array<LoadedPayload>
}

export const payloadBatchLimit = 128 * 1024 * 1024
export const payloadRequestLimit = 20_000
