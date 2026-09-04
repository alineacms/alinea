import {base64url} from '#/core/util/Encoding.js'
import type {FrameDescriptor, ReplicaState} from './Types.js'

export interface SerializedFrameDescriptor extends Omit<
  FrameDescriptor,
  'nonce'
> {
  nonce: string
}

export type SerializedReplicaState = ReplicaState

export function serializeReplicaState(state: ReplicaState): ReplicaState {
  return state
}

export function deserializeReplicaState(state: ReplicaState): ReplicaState {
  return state
}

export function serializeFrame(
  frame: FrameDescriptor
): SerializedFrameDescriptor {
  return {
    ...frame,
    nonce: base64url.stringify(frame.nonce, {pad: false})
  }
}

export function deserializeFrame(
  frame: SerializedFrameDescriptor
): FrameDescriptor {
  return {...frame, nonce: base64url.parse(frame.nonce, {loose: true})}
}
