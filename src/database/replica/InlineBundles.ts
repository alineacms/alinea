import {base64} from '#/core/util/Encoding.js'
import {MemoryRangeSource, type ByteRangeSourceFactory} from './Bundle.js'
import type {ReplicaState} from './Types.js'

export function replicaRangeSource(
  state: ReplicaState,
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
