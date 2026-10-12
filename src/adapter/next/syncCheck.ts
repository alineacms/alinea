import type {Client} from '#/core/Client.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import type {RemoteSource} from '#/core/source/Source.js'

interface SyncableDB {
  readonly sha: string | Promise<string>
  syncWith(source: RemoteSource, options?: SyncOptions): Promise<string>
}

// Tag for the shared latest-content-sha entry. Static pages that query
// content carry it as well, so the Next handler wrapper revalidating it after
// every commit also rebuilds those pages in the background. The time-based
// revalidate below is only a safety net for edits that bypass the handler
// (direct cloud writes, git pushes that do not redeploy, other deployments):
// they show up within five minutes.
export const CONTENT_SHA_TAG = 'alinea-content-sha'
const SHA_REVALIDATE_SECONDS = 300

// In-flight dedup so concurrent renders share one sha fetch.
let inflight: Promise<string | undefined> | undefined

function latestSha(client: Client): Promise<string | undefined> {
  if (inflight) return inflight
  inflight = loadLatestSha(client).finally(() => {
    inflight = undefined
  })
  return inflight
}

async function loadLatestSha(client: Client): Promise<string | undefined> {
  try {
    const {unstable_cache} = await import('next/cache.js')
    // The wrapper is created per call on purpose: the fetcher closes over
    // the request-scoped client, so it must not be hoisted to module scope.
    // Sharing still works because the cache key derives from this
    // function's source plus keyParts, not its identity.
    const getSha = unstable_cache(
      () => client.getSha(),
      ['alinea-content-sha'],
      {revalidate: SHA_REVALIDATE_SECONDS, tags: [CONTENT_SHA_TAG]}
    )
    return await getSha()
  } catch {
    // Outside Next runtime (tests, edge): direct fetch.
    try {
      return await client.getSha()
    } catch {
      return undefined
    }
  }
}

/**
 * Tag a static render with the content sha without looking it up. Renders at
 * build skip `syncIfStale`, so this is how their pages join the tag that
 * commits revalidate.
 */
export async function tagContentSha(): Promise<void> {
  try {
    const {unstable_cache} = await import('next/cache.js')
    await unstable_cache(async () => true, ['alinea-content-sha-tag'], {
      tags: [CONTENT_SHA_TAG]
    })()
  } catch {
    // Outside Next runtime there is no render to tag.
  }
}

export async function revalidateContentSha(): Promise<void> {
  try {
    const {revalidateTag} = await import('next/cache.js')
    // Mark stale instead of expiring. Static pages carry this tag through the
    // sha lookup (or tagContentSha at build), so they keep being served while
    // Next rebuilds them in the background. A rebuild waits for a stale
    // `unstable_cache` entry to refresh, so it reads the new sha and syncs
    // before rendering. Dynamic renders do not wait: the first one after a
    // commit can still answer from the previous sha while the entry refreshes.
    revalidateTag(CONTENT_SHA_TAG, 'max')
  } catch {
    // Not in a Next runtime, nothing shared to invalidate.
  }
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
  client: Client,
  syncInterval?: number,
  options?: SyncOptions
): Promise<boolean> {
  if (syncInterval === Number.POSITIVE_INFINITY) return true
  if (syncInterval === 0) {
    await db.syncWith(client, options)
    return true
  }
  const expected = await latestSha(client)
  if (!expected) return false
  if (expected !== (await db.sha)) await db.syncWith(client, options)
  return true
}
