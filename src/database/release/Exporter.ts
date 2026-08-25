import {crypto} from '@alinea/iso'
import type {DatabaseRecord, DatabaseSnapshot} from '../Database.js'
import type {DatabaseIndex, IndexedRecord} from '../SecondaryIndex.js'
import {entryReleaseAccessClass} from '../entry/Release.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'
import {replicaIndexKey} from '../Reader.js'
import {
  encryptFrame,
  packEncryptedFrames,
  type PackedBundle
} from '../replica/Bundle.js'
import type {
  AccessClassId,
  BundleId,
  FrameDescriptor,
  ReplicaCatalog
} from '../replica/Types.js'

const encoder = new TextEncoder()

export interface ReleaseFrameContext<Row extends DatabaseRecord> {
  kind: 'record' | 'index'
  /** The record itself, or the record contributing to an index fragment. */
  record: Row
  index?: DatabaseIndex<Row, unknown>
  indexKey?: string
}

export interface ReleaseExportOptions<Row extends DatabaseRecord> {
  bundleId: BundleId
  bundleUrl: string
  snapshot: DatabaseSnapshot<Row>
  accessClass(context: ReleaseFrameContext<Row>): AccessClassId
  compression?: 'none' | 'deflate' | 'gzip'
}

/** Kept beside handler output and never included in the public release. */
export interface HandlerKeyCatalog {
  version: 1
  bundleId: BundleId
  revision: string
  accessClasses: Readonly<Record<AccessClassId, Uint8Array>>
}

export interface ReleaseExport {
  bundle: PackedBundle
  catalog: ReplicaCatalog
  keys: HandlerKeyCatalog
}

/**
 * Turns a normalized snapshot into independently encrypted record and index
 * frames. Access classes can be per-record or shared by records with the same
 * effective role mask.
 */
export async function exportRelease<Row extends DatabaseRecord>(
  options: ReleaseExportOptions<Row>
): Promise<ReleaseExport> {
  const keys = new Map<AccessClassId, Uint8Array>()
  const frames = []
  const recordFrameIds = new Map<string, string>()
  const indexFrameIds = new Map<string, Array<string>>()

  for (const record of options.snapshot.records()) {
    const id = `record:${record.id}`
    const accessClassId = options.accessClass({kind: 'record', record})
    frames.push(
      await encryptFrame({
        bundleId: options.bundleId,
        id,
        accessClassId,
        key: keyFor(keys, accessClassId),
        contents: encode(record),
        compression: options.compression
      })
    )
    recordFrameIds.set(record.id, id)
  }

  for (const index of options.snapshot.schema.indexes) {
    for (const [key, bucket] of options.snapshot.buckets(index)) {
      const catalogKey = replicaIndexKey(index.name, key)
      const fragments = new Map<AccessClassId, Array<IndexedRecord<unknown>>>()
      for (const contribution of bucket) {
        const record = options.snapshot.get(contribution.id)
        if (!record)
          throw new Error(
            `Index references missing record "${contribution.id}"`
          )
        const accessClassId = options.accessClass({
          kind: 'index',
          record,
          index,
          indexKey: key
        })
        const fragment = fragments.get(accessClassId) ?? []
        fragment.push(contribution)
        fragments.set(accessClassId, fragment)
      }
      const ids: Array<string> = []
      let fragmentIndex = 0
      for (const [accessClassId, fragment] of fragments) {
        const id = `index:${catalogKey}:${fragmentIndex++}`
        frames.push(
          await encryptFrame({
            bundleId: options.bundleId,
            id,
            accessClassId,
            key: keyFor(keys, accessClassId),
            contents: encodeIndexBucket(fragment),
            compression: options.compression
          })
        )
        ids.push(id)
      }
      indexFrameIds.set(catalogKey, ids)
    }
  }

  const bundle = packEncryptedFrames(frames)
  const byId = new Map(bundle.frames.map(frame => [frame.id, frame]))
  return {
    bundle,
    catalog: {
      version: 1,
      bundleId: options.bundleId,
      bundleUrl: options.bundleUrl,
      revision: options.snapshot.revision,
      records: descriptors(recordFrameIds, byId),
      indexes: descriptorLists(indexFrameIds, byId)
    },
    keys: {
      version: 1,
      bundleId: options.bundleId,
      revision: options.snapshot.revision,
      accessClasses: Object.fromEntries(keys)
    }
  }
}

export function exportEntryRelease(
  options: Omit<ReleaseExportOptions<AlineaDatabaseRecord>, 'accessClass'>
): Promise<ReleaseExport> {
  return exportRelease({
    ...options,
    accessClass({record}) {
      return entryReleaseAccessClass(record)
    }
  })
}

function keyFor(
  keys: Map<AccessClassId, Uint8Array>,
  accessClassId: AccessClassId
): Uint8Array {
  let key = keys.get(accessClassId)
  if (!key) {
    key = crypto.getRandomValues(new Uint8Array(32))
    keys.set(accessClassId, key)
  }
  return key
}

function descriptors(
  ids: ReadonlyMap<string, string>,
  frames: ReadonlyMap<string, FrameDescriptor>
): Record<string, FrameDescriptor> {
  const result: Record<string, FrameDescriptor> = {}
  for (const [key, id] of ids) {
    const frame = frames.get(id)
    if (!frame) throw new Error(`Missing packed frame "${id}"`)
    result[key] = frame
  }
  return result
}

function descriptorLists(
  ids: ReadonlyMap<string, ReadonlyArray<string>>,
  frames: ReadonlyMap<string, FrameDescriptor>
): Record<string, ReadonlyArray<FrameDescriptor>> {
  const result: Record<string, ReadonlyArray<FrameDescriptor>> = {}
  for (const [key, frameIds] of ids)
    result[key] = frameIds.map(id => {
      const frame = frames.get(id)
      if (!frame) throw new Error(`Missing packed frame "${id}"`)
      return frame
    })
  return result
}

function encode(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value))
}

function encodeIndexBucket(
  bucket: ReadonlyArray<IndexedRecord<unknown>>
): Uint8Array {
  return encode({
    records: bucket.map(record => ({
      id: record.id,
      order: record.order,
      metadata: record.metadata
    }))
  })
}
