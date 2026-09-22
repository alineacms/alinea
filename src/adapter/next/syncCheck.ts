import type {Client} from '#/core/Client.js'
import type {SyncOptions} from '#/core/db/LocalStore.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'

interface SyncableDB {
  readonly sha: string | Promise<string>
  syncWith(source: RemoteSource, options?: SyncOptions): Promise<string>
}

// Tag for the shared latest-content-sha entry. The Next handler wrapper
// revalidates it after every commit, so renders learn about new content
// instantly. The time-based revalidate below is only a safety net for edits
// that bypass the handler (direct cloud writes).
export const CONTENT_SHA_TAG = 'alinea-content-sha'
const SHA_REVALIDATE_SECONDS = 60

// A sha that only matches an empty tree, so the handler answers with the
// current tree (metadata only, no blobs) whenever there is any content and
// we can read its sha. On an empty tree the answer is undefined, which the
// caller treats as unknown and falls back to its throttled sync.
const SENTINEL_SHA = ReadonlyTree.EMPTY.sha

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
      async () => {
        const tree = await client.getTreeIfDifferent(SENTINEL_SHA)
        return tree?.sha
      },
      ['alinea-content-sha'],
      {revalidate: SHA_REVALIDATE_SECONDS, tags: [CONTENT_SHA_TAG]}
    )
    return await getSha()
  } catch {
    // Outside Next runtime (tests, edge): direct fetch.
    try {
      const tree = await client.getTreeIfDifferent(SENTINEL_SHA)
      return tree?.sha
    } catch {
      return undefined
    }
  }
}

export async function revalidateContentSha(): Promise<void> {
  try {
    const {revalidateTag} = await import('next/cache.js')
    // {expire: 0} expires immediately: required on Next 16+, where the bare
    // single-arg form is deprecated and the default became
    // stale-while-revalidate. On older Next the extra argument is ignored
    // and immediate expiry was the only behavior.
    revalidateTag(CONTENT_SHA_TAG, {expire: 0})
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
