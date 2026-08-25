import {crypto} from '@alinea/iso'
import type {
  DatabaseChangeSet,
  DatabaseRecord,
  DatabaseSnapshot
} from '../Database.js'
import {replicaIndexKey} from '../Reader.js'
import type {IndexedRecord} from '../SecondaryIndex.js'
import {entryReleaseAccessClass} from '../entry/Release.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'
import {
  encryptFrame,
  packEncryptedFrames,
  type EncryptedFrame,
  type PackedBundle
} from '../replica/Bundle.js'
import type {
  AccessClassId,
  FrameDescriptor,
  ReplicaCatalog
} from '../replica/Types.js'
import type {
  HandlerKeyCatalog,
  ReleaseExportOptions,
  ReleaseFrameContext
} from './Exporter.js'

const encoder = new TextEncoder()

export interface ReleaseDeltaOptions<Row extends DatabaseRecord> {
  bundleId: string
  bundleUrl: string
  snapshot: DatabaseSnapshot<Row>
  changes: DatabaseChangeSet
  previousCatalog: ReplicaCatalog
  previousKeys: HandlerKeyCatalog
  accessClass(context: ReleaseFrameContext<Row>): AccessClassId
  compression?: ReleaseExportOptions<Row>['compression']
}

export interface ReleaseDelta {
  overlay: PackedBundle
  catalog: ReplicaCatalog
  keys: HandlerKeyCatalog
}

/** Encrypts only changed records and exact changed index buckets. */
export async function exportReleaseDelta<Row extends DatabaseRecord>(
  options: ReleaseDeltaOptions<Row>
): Promise<ReleaseDelta> {
  if (options.changes.toRevision !== options.snapshot.revision)
    throw new Error('Delta changes and snapshot revisions do not match')
  if (options.changes.fromRevision !== options.previousCatalog.revision)
    throw new Error('Delta does not continue from the previous catalog')
  const keys = new Map(Object.entries(options.previousKeys.accessClasses))
  const records = {...options.previousCatalog.records}
  const indexes = {...options.previousCatalog.indexes}
  const frames: Array<EncryptedFrame> = []
  const recordFrames = new Map<string, string>()
  const indexFrames = new Map<string, Array<string>>()

  for (const id of options.changes.records) {
    const record = options.snapshot.get(id)
    if (!record) {
      delete records[id]
      continue
    }
    const frameId = `record:${id}`
    const accessClassId = options.accessClass({kind: 'record', record})
    frames.push(
      await encryptFrame({
        bundleId: options.bundleId,
        id: frameId,
        accessClassId,
        key: keyFor(keys, accessClassId),
        contents: encoder.encode(JSON.stringify(record)),
        compression: options.compression
      })
    )
    recordFrames.set(id, frameId)
  }

  for (const changed of options.changes.indexes) {
    const index = options.snapshot.schema.get(changed.index)
    if (!index) throw new Error(`Missing changed index "${changed.index}"`)
    const catalogKey = replicaIndexKey(changed.index, changed.key)
    const fragments = new Map<AccessClassId, Array<IndexedRecord<unknown>>>()
    for (const contribution of options.snapshot.scan(index, changed.key)) {
      const record = options.snapshot.get(contribution.id)
      if (!record)
        throw new Error(`Index references missing record "${contribution.id}"`)
      const accessClassId = options.accessClass({
        kind: 'index',
        record,
        index,
        indexKey: changed.key
      })
      const fragment = fragments.get(accessClassId) ?? []
      fragment.push(contribution)
      fragments.set(accessClassId, fragment)
    }
    if (fragments.size === 0) {
      delete indexes[catalogKey]
      continue
    }
    const ids: Array<string> = []
    let position = 0
    for (const [accessClassId, fragment] of fragments) {
      const frameId = `index:${catalogKey}:${position++}`
      frames.push(
        await encryptFrame({
          bundleId: options.bundleId,
          id: frameId,
          accessClassId,
          key: keyFor(keys, accessClassId),
          contents: encodeIndexBucket(fragment),
          compression: options.compression
        })
      )
      ids.push(frameId)
    }
    indexFrames.set(catalogKey, ids)
  }

  const overlay = packEncryptedFrames(frames)
  const byId = new Map(
    overlay.frames.map(frame => [
      frame.id,
      withOverlayLocation(frame, options.bundleId, options.bundleUrl)
    ])
  )
  for (const [id, frameId] of recordFrames)
    records[id] = required(byId, frameId)
  for (const [key, frameIds] of indexFrames)
    indexes[key] = frameIds.map(id => required(byId, id))
  return {
    overlay,
    catalog: {
      ...options.previousCatalog,
      revision: options.snapshot.revision,
      records,
      indexes
    },
    keys: {
      ...options.previousKeys,
      revision: options.snapshot.revision,
      accessClasses: Object.fromEntries(keys)
    }
  }
}

export function exportEntryReleaseDelta(
  options: Omit<ReleaseDeltaOptions<AlineaDatabaseRecord>, 'accessClass'>
): Promise<ReleaseDelta> {
  return exportReleaseDelta({
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

function encodeIndexBucket(
  bucket: ReadonlyArray<IndexedRecord<unknown>>
): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      records: bucket.map(record => ({
        id: record.id,
        order: record.order,
        metadata: record.metadata
      }))
    })
  )
}

function withOverlayLocation(
  frame: FrameDescriptor,
  bundleId: string,
  bundleUrl: string
): FrameDescriptor {
  return {...frame, bundleId, bundleUrl}
}

function required(
  frames: ReadonlyMap<string, FrameDescriptor>,
  id: string
): FrameDescriptor {
  const frame = frames.get(id)
  if (!frame) throw new Error(`Missing overlay frame "${id}"`)
  return frame
}
