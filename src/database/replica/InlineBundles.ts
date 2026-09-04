import {base64} from '#/core/util/Encoding.js'
import {applyRuntimeDelta, runtimeBundleIds} from '../runtime/Snapshot.js'
import {MemoryRangeSource, type ByteRangeSourceFactory} from './Bundle.js'
import type {ReplicaSnapshotState, ReplicaState} from './Types.js'

export function replicaRangeSource(
  state: ReplicaSnapshotState,
  fallback: ByteRangeSourceFactory
): ByteRangeSourceFactory {
  const bundles = new Map(
    Object.entries(state.inlineBundles ?? {}).map(([id, contents]) => [
      id,
      new MemoryRangeSource(base64.parse(contents))
    ])
  )
  return url => {
    const parsed = new URL(url, 'http://alinea.local')
    const bundleId =
      parsed.searchParams.get('bundle') ??
      (url === state.runtime?.bundleUrl ? state.runtime.bundleId : undefined)
    return (bundleId && bundles.get(bundleId)) || fallback(url)
  }
}

export function applyReplicaState(
  previous: ReplicaSnapshotState | undefined,
  update: ReplicaState
): ReplicaSnapshotState {
  if ('runtime' in update) return update
  if (!previous)
    throw new Error('Cannot apply a replica delta without a snapshot')
  if (previous.viewId !== update.viewId)
    throw new Error('Replica delta does not match the authenticated view')
  const runtime = applyRuntimeDelta(previous.runtime, update.delta)
  const available = {
    ...previous.inlineBundles,
    ...update.inlineBundles
  }
  const live = runtimeBundleIds(runtime)
  const inlineBundles = Object.fromEntries(
    Object.entries(available).filter(([bundleId]) => live.has(bundleId))
  )
  return {
    viewId: update.viewId,
    runtime,
    ...(Object.keys(inlineBundles).length > 0 ? {inlineBundles} : {})
  }
}
