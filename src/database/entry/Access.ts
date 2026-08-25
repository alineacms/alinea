import type {Resource} from '#/core/Role.js'
import type {EntryCoreRecord} from './Model.js'

export type EntrySyncAccess = 'none' | 'explore' | 'read'

export interface EntryAccessPolicy {
  canExplore(resource?: Resource): boolean
  canRead(resource?: Resource): boolean
}

export interface EntrySyncSelection {
  access: EntrySyncAccess
  syncCore: boolean
  syncReadMetadata: boolean
  syncPayload: boolean
  searchAudience: 'none' | 'explore' | 'read'
}

/**
 * Converts the effective Role policy into the data tiers that may be granted
 * to a client. Explore is enough for picker-safe structural data, never for the
 * entry payload or search text derived from that payload.
 */
export function selectEntryForSync(
  policy: EntryAccessPolicy,
  entry: EntryCoreRecord
): EntrySyncSelection {
  const resource = entryResource(entry)
  if (policy.canRead(resource)) {
    return {
      access: 'read',
      syncCore: true,
      syncReadMetadata: true,
      syncPayload: true,
      searchAudience: 'read'
    }
  }
  if (policy.canExplore(resource)) {
    return {
      access: 'explore',
      syncCore: true,
      syncReadMetadata: false,
      syncPayload: false,
      searchAudience: 'explore'
    }
  }
  return {
    access: 'none',
    syncCore: false,
    syncReadMetadata: false,
    syncPayload: false,
    searchAudience: 'none'
  }
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
