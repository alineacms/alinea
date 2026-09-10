import {ReadonlyTree, type Entry as TreeEntry} from '#/core/source/Tree.js'
import type {EntryReplacement} from '../runtime/EntryRuntime.js'

interface Identity {
  id: string
  parentId: string | null
  workspace: string
  root: string
  parentSha: string
  childrenSha: string
  versions: ReadonlyArray<EntryReplacement>
}

/** Construct the ordinary source Tree representation from pre-hashed index
 * rows. Every authored version participates, including invisible versions. */
export function entryTree(
  entries: ReadonlyArray<EntryReplacement>,
  rootSha: string
): ReadonlyTree {
  if (!rootSha) throw new Error('An entry tree root hash is required')
  const grouped = new Map<string, Array<EntryReplacement>>()
  for (const replacement of entries) {
    const versions = grouped.get(replacement.entry.id) ?? []
    versions.push(replacement)
    grouped.set(replacement.entry.id, versions)
  }
  const identities = new Map<string, Identity>()
  for (const [id, versions] of grouped) {
    const first = versions[0].entry
    const parentShas = new Set(
      versions.flatMap(({entry}) => (entry.parentSha ? [entry.parentSha] : []))
    )
    const childrenShas = new Set(
      versions.flatMap(({entry}) =>
        entry.childrenSha ? [entry.childrenSha] : []
      )
    )
    if (
      versions.some(
        ({entry}) =>
          entry.parentId !== first.parentId ||
          entry.workspace !== first.workspace ||
          entry.root !== first.root
      ) ||
      parentShas.size !== 1 ||
      childrenShas.size !== 1
    )
      throw new Error(`Incomplete or inconsistent entry tree hashes: ${id}`)
    identities.set(id, {
      id,
      parentId: first.parentId,
      workspace: first.workspace,
      root: first.root,
      parentSha: [...parentShas][0],
      childrenSha: [...childrenShas][0],
      versions
    })
  }

  const children = new Map<string | null, Array<Identity>>()
  for (const identity of identities.values()) {
    const parent = identity.parentId
      ? (identities.get(identity.parentId) ?? null)
      : null
    if (identity.parentId && !parent)
      throw new Error(`Missing entry tree parent: ${identity.parentId}`)
    const expected = parent?.childrenSha ?? rootSha
    if (identity.parentSha !== expected)
      throw new Error(`Entry parent hash mismatch: ${identity.id}`)
    const nested = children.get(identity.parentId) ?? []
    nested.push(identity)
    children.set(identity.parentId, nested)
  }

  const visiting = new Set<string>()
  function directory(identity: Identity): TreeEntry {
    if (visiting.has(identity.id))
      throw new Error(`Cyclic entry tree: ${identity.id}`)
    visiting.add(identity.id)
    const versions: Array<TreeEntry> = identity.versions
      .map(({entry}) => ({
        name: encode(
          JSON.stringify([
            entry.locale?.toLowerCase() ?? null,
            entry.versionStatus
          ])
        ),
        sha: entry.rowHash,
        mode: '100644'
      }))
      .sort((a, b) => compare(a.name, b.name))
    const nested = (children.get(identity.id) ?? [])
      .map(directory)
      .sort((a, b) => compare(a.name, b.name))
    visiting.delete(identity.id)
    return {
      name: encode(identity.id),
      sha: identity.childrenSha,
      mode: '040000',
      entries: [...versions, ...nested]
    }
  }

  const roots = (children.get(null) ?? [])
    .map(identity => ({
      ...directory(identity),
      name: encode(
        JSON.stringify([identity.workspace, identity.root, identity.id])
      )
    }))
    .sort((a, b) => compare(a.name, b.name))
  return new ReadonlyTree({sha: rootSha, entries: roots})
}

function encode(value: string): string {
  return encodeURIComponent(value)
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
