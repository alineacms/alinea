import {Entry} from '#/core/Entry.js'
import {FileData} from '#/core/media/MediaTypes.js'
import type {Permission} from '#/core/Role.js'
import type {Getter} from 'jotai'
import {graphAtom} from './core.js'
import {policyAtom} from './user.js'

/** What shows of an entry linked from another entry */
export interface LinkedEntry {
  id: string
  title: string
  /** A small data url preview of an image */
  preview?: string
  averageColor?: string
}

export interface LinkedEntryVersion extends LinkedEntry {
  locale: string | null
}

/** The versions of the linked entries the permission allows, by id */
export async function linkedEntryVersions(
  get: Getter,
  ids: Array<string>,
  permission: Permission
): Promise<Map<string, Array<LinkedEntryVersion>>> {
  const byId = new Map<string, Array<LinkedEntryVersion>>()
  if (ids.length === 0) return byId
  const policy = get(policyAtom)
  const rows = await get(graphAtom).find({
    id: {in: ids},
    status: 'preferDraft',
    select: {
      id: Entry.id,
      title: Entry.title,
      workspace: Entry.workspace,
      root: Entry.root,
      locale: Entry.locale,
      parents: Entry.parents,
      preview: FileData.preview,
      averageColor: FileData.averageColor
    }
  })
  for (const row of rows) {
    if (!policy.check(permission, row)) continue
    const versions = byId.get(row.id) ?? []
    versions.push(row as LinkedEntryVersion)
    byId.set(row.id, versions)
  }
  return byId
}

/** The version in the locale, else the one without a locale, else any */
export function pickLinkedEntry(
  versions: Array<LinkedEntryVersion> | undefined,
  locale: string | null
): LinkedEntry | undefined {
  if (!versions?.length) return undefined
  const row =
    versions.find(row => row.locale === locale) ??
    versions.find(row => row.locale === null) ??
    versions[0]
  return {
    id: row.id,
    title: row.title,
    preview: row.preview || undefined,
    averageColor: row.averageColor || undefined
  }
}
