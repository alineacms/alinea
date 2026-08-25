import {base64url} from '#/core/util/Encoding.js'
import type {HandlerKeyCatalog} from '../release/Exporter.js'
import type {
  AccessClassGrant,
  FrameDescriptor,
  ReplicaCatalog,
  ReplicaState
} from './Types.js'

export interface SerializedFrameDescriptor extends Omit<
  FrameDescriptor,
  'nonce'
> {
  nonce: string
}

export interface SerializedReplicaCatalog extends Omit<
  ReplicaCatalog,
  'records' | 'indexes'
> {
  records: Readonly<Record<string, SerializedFrameDescriptor>>
  indexes: Readonly<Record<string, ReadonlyArray<SerializedFrameDescriptor>>>
}

export interface SerializedAccessClassGrant extends Omit<
  AccessClassGrant,
  'key'
> {
  key: string
}

export interface SerializedReplicaState extends Omit<
  ReplicaState,
  'catalog' | 'grants'
> {
  catalog: SerializedReplicaCatalog
  grants: ReadonlyArray<SerializedAccessClassGrant>
}

export interface SerializedHandlerKeyCatalog extends Omit<
  HandlerKeyCatalog,
  'accessClasses'
> {
  accessClasses: Readonly<Record<string, string>>
}

export function serializeReplicaCatalog(
  catalog: ReplicaCatalog
): SerializedReplicaCatalog {
  return {
    ...catalog,
    records: Object.fromEntries(
      Object.entries(catalog.records).map(([id, frame]) => [
        id,
        serializeFrame(frame)
      ])
    ),
    indexes: Object.fromEntries(
      Object.entries(catalog.indexes).map(([key, frames]) => [
        key,
        frames.map(serializeFrame)
      ])
    )
  }
}

export function deserializeReplicaCatalog(
  catalog: SerializedReplicaCatalog
): ReplicaCatalog {
  return {
    ...catalog,
    records: Object.fromEntries(
      Object.entries(catalog.records).map(([id, frame]) => [
        id,
        deserializeFrame(frame)
      ])
    ),
    indexes: Object.fromEntries(
      Object.entries(catalog.indexes).map(([key, frames]) => [
        key,
        frames.map(deserializeFrame)
      ])
    )
  }
}

export function serializeReplicaState(
  state: ReplicaState
): SerializedReplicaState {
  return {
    ...state,
    catalog: serializeReplicaCatalog(state.catalog),
    grants: state.grants.map(grant => ({
      accessClassId: grant.accessClassId,
      key: base64url.stringify(grant.key, {pad: false})
    }))
  }
}

export function deserializeReplicaState(
  state: SerializedReplicaState
): ReplicaState {
  return {
    ...state,
    catalog: deserializeReplicaCatalog(state.catalog),
    grants: state.grants.map(grant => ({
      accessClassId: grant.accessClassId,
      key: base64url.parse(grant.key, {loose: true})
    }))
  }
}

export function serializeHandlerKeys(
  catalog: HandlerKeyCatalog
): SerializedHandlerKeyCatalog {
  return {
    ...catalog,
    accessClasses: Object.fromEntries(
      Object.entries(catalog.accessClasses).map(([id, key]) => [
        id,
        base64url.stringify(key, {pad: false})
      ])
    )
  }
}

export function deserializeHandlerKeys(
  catalog: SerializedHandlerKeyCatalog
): HandlerKeyCatalog {
  return {
    ...catalog,
    accessClasses: Object.fromEntries(
      Object.entries(catalog.accessClasses).map(([id, key]) => [
        id,
        base64url.parse(key, {loose: true})
      ])
    )
  }
}

function serializeFrame(frame: FrameDescriptor): SerializedFrameDescriptor {
  return {
    ...frame,
    nonce: base64url.stringify(frame.nonce, {pad: false})
  }
}

function deserializeFrame(frame: SerializedFrameDescriptor): FrameDescriptor {
  return {...frame, nonce: base64url.parse(frame.nonce, {loose: true})}
}
