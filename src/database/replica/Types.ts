export type Revision = string
export type ViewId = string
export type BundleId = string
export type FrameId = string
export type AccessClassId = string
export type RecordId = string
export type IndexKey = string
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
  cipherHash: ContentHash
  compression: FrameCompression
}

export interface AccessClassGrant {
  accessClassId: AccessClassId
  key: Uint8Array
}

export interface ReplicaCatalog {
  version: 1
  bundleId: BundleId
  bundleUrl: string
  revision: Revision
  records: Readonly<Record<RecordId, FrameDescriptor>>
  /** One bucket may contain several independently granted fragments. */
  indexes: Readonly<Record<IndexKey, ReadonlyArray<FrameDescriptor>>>
}

export interface ReplicaState {
  viewId: ViewId
  catalog: ReplicaCatalog
  grants: ReadonlyArray<AccessClassGrant>
  /** Effective access for synchronized core records, computed by the handler. */
  recordAccess: Readonly<Record<RecordId, 'explore' | 'read'>>
}

export interface RecordReference<Metadata = Record<string, unknown>> {
  id: RecordId
  frame: FrameDescriptor
  order: ReadonlyArray<boolean | number | string | null>
  metadata: Metadata
}

export interface IndexBucket<Metadata = Record<string, unknown>> {
  records: ReadonlyArray<{
    id: RecordId
    order?: ReadonlyArray<boolean | number | string | null>
    metadata: Metadata
  }>
}
