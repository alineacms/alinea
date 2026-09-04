import {base64url} from '#/core/util/Encoding.js'
import {
  deserializeRuntimeDatabaseIndex,
  serializeRuntimeDatabaseIndex,
  type SerializedRuntimeDatabaseIndex
} from '../runtime/Serialization.js'
import type {
  AccessClassId,
  FrameCompression,
  FrameDescriptor,
  FrameId,
  ReplicaState
} from './Types.js'

/** Compact runtime form; frame identity and the gzip default are derived. */
export interface SerializedFrameDescriptor {
  offset: number
  length: number
  nonce: string
  compression?: FrameCompression
  /** Present only when a live frame overrides the base bundle. */
  bundleId?: string
  bundleUrl?: string
}

export interface SerializedReplicaState extends Omit<ReplicaState, 'runtime'> {
  runtime: SerializedRuntimeDatabaseIndex
}

export function serializeReplicaState(
  state: ReplicaState
): SerializedReplicaState {
  return {...state, runtime: serializeRuntimeDatabaseIndex(state.runtime)}
}

export function deserializeReplicaState(
  state: SerializedReplicaState
): ReplicaState {
  return {...state, runtime: deserializeRuntimeDatabaseIndex(state.runtime)}
}

export function serializeFrame(
  frame: FrameDescriptor
): SerializedFrameDescriptor {
  return {
    offset: frame.offset,
    length: frame.length,
    nonce: base64url.stringify(frame.nonce, {pad: false}),
    compression: frame.compression === 'gzip' ? undefined : frame.compression,
    bundleId: frame.bundleId,
    bundleUrl: frame.bundleUrl
  }
}

export function deserializeFrame(
  frame: SerializedFrameDescriptor,
  id: FrameId,
  accessClassId: AccessClassId
): FrameDescriptor {
  return {
    id,
    accessClassId,
    offset: frame.offset,
    length: frame.length,
    nonce: base64url.parse(frame.nonce, {loose: true}),
    compression: frame.compression ?? 'gzip',
    bundleId: frame.bundleId,
    bundleUrl: frame.bundleUrl
  }
}
