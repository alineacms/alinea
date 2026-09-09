import type {ReplicaIdentity} from '../browser/ReplicaCache.js'
import type {PayloadRequest} from '../runtime/EntryRuntime.js'
import type {FrameDescriptor} from './Frame.js'

export interface PayloadBatchRequest {
  identity: ReplicaIdentity
  revision: string
  requests: Array<PayloadRequest>
}

export interface EncodedFrame {
  descriptor: Omit<FrameDescriptor, 'nonce'> & {nonce: string}
  key: string
  ciphertext: string
}

/** Authenticated, non-cacheable envelope; only ciphertext belongs in disk caches. */
export interface PayloadBatch {
  version: 1
  identity: ReplicaIdentity
  revision: string
  frames: Array<EncodedFrame>
}

export const payloadBatchLimit = 32 * 1024 * 1024
