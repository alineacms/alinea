import {ReadonlyTree, type Entry as TreeEntry} from '#/core/source/Tree.js'

export interface EntryTreeRow {
  id: string
  versionId: string
  rowHash: string
  parentId: string | null
  childrenSha: string | null
}

interface Identity {
  id: string
  parentId: string | null
  childrenSha: string
  versions: ReadonlyArray<EntryTreeRow>
}

/** Construct the ordinary source Tree representation from pre-hashed rows.
 * Rows must be ordered by parent id, entry id and version id. */
export function entryTree(
  entries: ReadonlyArray<EntryTreeRow>,
  rootSha: string
): ReadonlyTree {
  if (!rootSha) throw new Error('An entry tree root hash is required')
  const grouped = new Map<string, Array<EntryTreeRow>>()
  for (const entry of entries) {
    const versions = grouped.get(entry.id) ?? []
    versions.push(entry)
    grouped.set(entry.id, versions)
  }
  const identities = new Map<string, Identity>()
  for (const [id, versions] of grouped) {
    const first = versions[0]
    const childrenSha = first.childrenSha
    if (
      !childrenSha ||
      versions.some(
        entry =>
          entry.parentId !== first.parentId || entry.childrenSha !== childrenSha
      )
    )
      throw new Error(`Incomplete or inconsistent entry tree hashes: ${id}`)
    identities.set(id, {id, parentId: first.parentId, childrenSha, versions})
  }

  const children = new Map<string | null, Array<Identity>>()
  for (const identity of identities.values()) {
    if (identity.parentId && !identities.has(identity.parentId))
      throw new Error(`Missing entry tree parent: ${identity.parentId}`)
    const nested = children.get(identity.parentId) ?? []
    nested.push(identity)
    children.set(identity.parentId, nested)
  }

  const visiting = new Set<string>()
  function directory(identity: Identity): TreeEntry {
    if (visiting.has(identity.id))
      throw new Error(`Cyclic entry tree: ${identity.id}`)
    visiting.add(identity.id)
    const versions: Array<TreeEntry> = identity.versions.map(entry => ({
      name: entry.versionId,
      sha: entry.rowHash,
      mode: '100644'
    }))
    const nested = (children.get(identity.id) ?? []).map(directory)
    visiting.delete(identity.id)
    return {
      name: identity.id,
      sha: identity.childrenSha,
      mode: '040000',
      entries: [...versions, ...nested]
    }
  }

  return new ReadonlyTree({
    sha: rootSha,
    entries: (children.get(null) ?? []).map(directory)
  })
}
