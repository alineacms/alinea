import type {ReplicaIdentity, CachedEntry} from '../browser/ReplicaCache.js'

/** Authenticated index only. No source bytes, frame keys or payload plaintext. */
export interface IndexBootstrap {
  version: 1
  identity: ReplicaIdentity
  revision: string
  permissions: number
  entries: Array<CachedEntry>
}
