import type {Resource} from '#/core/Role.js'
import type {EntryCoreRecord} from './Model.js'

export type EntrySyncAccess = 'none' | 'explore' | 'read'

export interface EntryAccessPolicy {
  canExplore(resource?: Resource): boolean
  canRead(resource?: Resource): boolean
}

/**
 * Converts the effective Role policy into the data tiers that may be granted
 * to a client. Explore is enough for picker-safe structural data, never for the
 * entry payload or search text derived from that payload.
 */
export function entrySyncAccess(
  policy: EntryAccessPolicy,
  entry: EntryCoreRecord
): EntrySyncAccess {
  if (!entry.queryable) return 'none'
  const resource = entryResource(entry)
  if (policy.canRead(resource)) return 'read'
  if (policy.canExplore(resource)) return 'explore'
  return 'none'
}

export function entryResource(entry: EntryCoreRecord): Resource {
  return {
    workspace: entry.workspace,
    root: entry.root,
    type: entry.type,
    id: entry.entryId,
    parents: [...entry.parents],
    locale: entry.locale
  }
}
