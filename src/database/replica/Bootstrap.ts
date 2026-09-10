import type {ReplicaIdentity, CachedEntry} from '../browser/ReplicaCache.js'
import type {PolicyData} from '#/core/Role.js'

/** Authenticated index only. No source bytes, frame keys or payload plaintext. */
export interface IndexBootstrap {
  version: 1
  identity: ReplicaIdentity
  revision: string
  permissions: number
  scopePolicy: PolicyData
  entries: Array<CachedEntry>
}
