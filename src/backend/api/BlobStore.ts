import type {CommitApi, SyncApi} from '#/core/Connection.js'
import {hashBlob} from '#/core/source/GitUtils.js'

/**
 * Content blobs kept where every handler instance finds them, such as the
 * backend database: an instance that is behind reads what another one
 * fetched or committed, instead of fetching it from the remote again.
 */
export interface BlobStore {
  /** The stored blobs among `shas`. */
  readBlobs(shas: ReadonlyArray<string>): Promise<Map<string, Uint8Array>>
  /** Keep blobs, found again by their sha. */
  storeBlobs(
    blobs: ReadonlyArray<[sha: string, blob: Uint8Array]>
  ): Promise<void>
}

/** Blobs kept per write to the store while they stream in. */
const storeBatch = 100

export function isBlobStore<T extends object>(
  value: T
): value is T & BlobStore {
  return (
    'readBlobs' in value &&
    typeof value.readBlobs === 'function' &&
    'storeBlobs' in value &&
    typeof value.storeBlobs === 'function'
  )
}

/**
 * Answer from the store what it has, and fetch the rest from the remote,
 * storing it. The store only saves requests: when it fails, the remote
 * answers instead.
 */
export function storedBlobs(
  store: BlobStore,
  getBlobs: SyncApi['getBlobs']
): SyncApi['getBlobs'] {
  return async function* (shas, options) {
    const stored = await store.readBlobs(shas).catch(error => {
      console.warn('Alinea could not read stored blobs', error)
      return new Map<string, Uint8Array>()
    })
    for (const sha of shas) {
      const blob = stored.get(sha)
      if (blob) yield [sha, blob]
    }
    const missing = shas.filter(sha => !stored.has(sha))
    if (missing.length === 0) return
    let fetched = Array<[sha: string, blob: Uint8Array]>()
    const keep = async () => {
      const blobs = fetched
      fetched = []
      if (blobs.length > 0) await keepBlobs(store, blobs)
    }
    try {
      for await (const entry of getBlobs(missing, options)) {
        fetched.push(entry)
        if (fetched.length >= storeBatch) await keep()
        yield entry
      }
    } finally {
      await keep()
    }
  }
}

/** Commit through the remote, and store the committed content. */
export function storedWrites(
  store: BlobStore,
  write: CommitApi['write']
): CommitApi['write'] {
  return async request => {
    const result = await write(request)
    const encoder = new TextEncoder()
    const blobs = Array<[sha: string, blob: Uint8Array]>()
    for (const change of request.changes) {
      if (change.op !== 'addContent') continue
      const blob = encoder.encode(change.contents)
      // Blobs are found by their sha, so only one that hashes to it is kept.
      if ((await hashBlob(blob)) === change.sha) blobs.push([change.sha, blob])
    }
    if (blobs.length > 0) await keepBlobs(store, blobs)
    return result
  }
}

async function keepBlobs(
  store: BlobStore,
  blobs: ReadonlyArray<[sha: string, blob: Uint8Array]>
): Promise<void> {
  try {
    await store.storeBlobs(blobs)
  } catch (error) {
    console.warn('Alinea could not store blobs', error)
  }
}
