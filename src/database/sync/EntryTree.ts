import {
  ReadonlyTree,
  type Entry as TreeEntry,
  WriteableTree
} from '#/core/source/Tree.js'

export interface EntryTreeRow {
  id: string
  versionId: string
  rowHash: string
  parentId: string | null
  /** Cached logical-directory hash supplied by the server. */
  childrenSha: string | null
}

interface Identity {
  id: string
  parentId: string | null
  childrenSha: string
  versions: ReadonlyArray<EntryTreeRow>
}

export interface EntryTreeSourceRow {
  id: string
  versionId: string
  rowHash: string
  parentId: string | null
}

/**
 * Compute directory hashes once at the source. The values travel with rows so
 * browser replicas can rebuild the tree without hashing their full database.
 */
export async function entryTreeHashes(
  entries: Iterable<EntryTreeSourceRow>
): Promise<Map<string, string>> {
  const parents = new Map<string, string | null>()
  const versions = new Map<
    string,
    Array<Pick<EntryTreeSourceRow, 'versionId' | 'rowHash'>>
  >()
  for (const entry of entries) {
    const previous = parents.get(entry.id)
    if (previous !== undefined && previous !== entry.parentId)
      throw new Error(`Inconsistent entry tree parent: ${entry.id}`)
    parents.set(entry.id, entry.parentId)
    const nested = versions.get(entry.id) ?? []
    nested.push({versionId: entry.versionId, rowHash: entry.rowHash})
    versions.set(entry.id, nested)
  }
  const paths = new Map<string, string>()
  const visiting = new Set<string>()
  function pathFor(id: string): string {
    const known = paths.get(id)
    if (known) return known
    if (visiting.has(id)) throw new Error(`Cyclic entry tree: ${id}`)
    const parentId = parents.get(id)
    if (parentId === undefined) throw new Error(`Missing entry tree: ${id}`)
    if (parentId && !parents.has(parentId))
      throw new Error(`Missing entry tree parent: ${parentId}`)
    visiting.add(id)
    const path = parentId ? `${pathFor(parentId)}/${id}` : id
    visiting.delete(id)
    paths.set(id, path)
    return path
  }

  const tree = new WriteableTree()
  for (const [id, nested] of versions) {
    const path = pathFor(id)
    for (const entry of nested)
      tree.add(`${path}/${entry.versionId}`, entry.rowHash)
  }
  const compiled = await tree.compile()
  return new Map(
    Array.from(parents.keys(), id => [id, compiled.getNode(pathFor(id)).sha])
  )
}

/** Construct the sync tree from pre-hashed rows, without hashing on the client. */
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
