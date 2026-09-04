import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import type {RuntimeDelta} from '../runtime/Snapshot.js'

export type Revision = string
export type ViewId = string
export type BundleId = string
export type FrameId = string
export type AccessClassId = string
export type RecordId = string
export type ContentHash = string

export type FrameCompression = 'none' | 'deflate' | 'gzip'

export interface FrameDescriptor {
  id: FrameId
  /** Overrides the base catalog bundle for handler-produced overlay frames. */
  bundleId?: BundleId
  bundleUrl?: string
  accessClassId: AccessClassId
  offset: number
  length: number
  nonce: Uint8Array
  compression: FrameCompression
}

export interface AccessClassGrant {
  accessClassId: AccessClassId
  key: Uint8Array
}

export interface ReplicaSnapshotState {
  viewId: ViewId
  runtime: RuntimeDatabaseIndex
  /** Entry-sized live overlay bundles carried with their authorized view. */
  inlineBundles?: Readonly<Record<BundleId, string>>
}

export interface ReplicaDeltaState {
  viewId: ViewId
  delta: RuntimeDelta
  /** Ciphertext required by the changed rows in this delta. */
  inlineBundles?: Readonly<Record<BundleId, string>>
}

export type ReplicaState = ReplicaSnapshotState | ReplicaDeltaState
