import type {RemoteSource} from '#/core/source/Source.js'
import type {
  LocalStore,
  SyncOptions,
  SyncStats,
  SyncStep
} from './LocalStore.js'

export const syncSteps: Array<SyncStep> = [
  'tree',
  'blobs',
  'parse',
  'write',
  'derive',
  'analyze'
]

export function syncStats(): SyncStats {
  return {steps: {}, files: 0, versions: 0}
}

/** Add the time `run` takes to a step, when the sync is measured. */
export async function timeStep<T>(
  stats: SyncStats | undefined,
  step: SyncStep,
  run: () => T | Promise<T>
): Promise<T> {
  if (!stats) return run()
  const start = performance.now()
  try {
    return await run()
  } finally {
    stats.steps[step] = (stats.steps[step] ?? 0) + performance.now() - start
  }
}

/**
 * Sync and log why, between which revisions and where the time went, also
 * when it fails: slow syncs are found in the server logs.
 */
export async function loggedSync(
  store: Pick<LocalStore, 'sha' | 'syncWith'>,
  remote: RemoteSource,
  reason: string,
  options: SyncOptions = {}
): Promise<string> {
  const stats = options.stats ?? syncStats()
  const from = await store.sha
  const start = performance.now()
  let to: string | undefined
  try {
    return (to = await store.syncWith(remote, {...options, stats}))
  } finally {
    const durationMs = performance.now() - start
    console.info(describeSync(reason, from, to, durationMs, stats))
  }
}

/**
 * Such as `Alinea synced 1a2b3c4 → 5d6e7f8 (interval) in 812 ms: tree 80 ms,
 * blobs 410 ms, …, 1 file, 4 versions derived`.
 */
export function describeSync(
  reason: string,
  from: string,
  to: string | undefined,
  durationMs: number,
  stats: SyncStats
): string {
  const {steps, files, versions} = stats
  const parts = syncSteps.flatMap(step => {
    const ms = steps[step]
    return ms === undefined ? [] : `${step} ${Math.round(ms)} ms`
  })
  const head =
    to === undefined
      ? `Alinea failed to sync from ${from.slice(0, 7)}`
      : from === to
        ? `Alinea is current at ${to.slice(0, 7)}`
        : `Alinea synced ${from.slice(0, 7)} → ${to.slice(0, 7)}`
  if (from !== to)
    parts.push(
      `${files} ${files === 1 ? 'file' : 'files'}`,
      `${versions} ${versions === 1 ? 'version' : 'versions'} derived`
    )
  return `${head} (${reason}) in ${Math.round(durationMs)} ms: ${parts.join(', ')}`
}
