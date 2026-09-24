import type {SyncOptions} from '#/core/db/LocalStore.js'

interface SyncableDB {
  readonly sha: string | Promise<string>
  syncWith(options?: SyncOptions): Promise<string>
}

/**
 * Sync the isolate-local db only when it is behind the shared content sha.
 * Returns true when the freshness question is settled here (synced, forced,
 * or explicitly disabled) and the caller can skip its throttled sync.
 * Returns false when the sha could not be determined, so the caller falls
 * back to its existing throttle behavior.
 */
export async function syncIfStale(
  db: SyncableDB,
  latestSha: () => Promise<string | undefined>,
  syncInterval?: number,
  options?: SyncOptions
): Promise<boolean> {
  if (syncInterval === Number.POSITIVE_INFINITY) return true
  if (syncInterval === 0) {
    await db.syncWith(options)
    return true
  }
  const expected = await latestSha()
  if (!expected) return false
  if (expected !== (await db.sha)) await db.syncWith(options)
  return true
}
