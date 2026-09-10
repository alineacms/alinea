import {crypto} from '@alinea/iso'
import {entryIndexRow} from '../entry/Schema.js'
import type {EntryReplacement} from '../runtime/EntryRuntime.js'

export interface IndexTreeLeaf {
  kind: 'entry'
  key: string
  versionId: string
  /** Canonical commitment included in the containing directory hash. */
  hash: string
}

export interface IndexTreeDirectory {
  kind: 'directory'
  key: string
  /** SHA-256 of the ordered child keys and commitments. */
  hash: string
  children: ReadonlyArray<IndexTreeNode>
}

export type IndexTreeNode = IndexTreeDirectory | IndexTreeLeaf

export interface IndexTreeDelta {
  fromHash: string
  toHash: string
  replacements: Array<string>
  removedVersionIds: Array<string>
}

/** A disposable Merkle projection over index rows. Stable key-defined buckets
 * avoid the offset sensitivity of fixed-size chunks: inserting one version
 * changes one bucket and the root, independent of lexical insertion position. */
export class IndexTree {
  readonly root: IndexTreeDirectory

  private constructor(root: IndexTreeDirectory) {
    this.root = root
  }

  static async from(
    entries: ReadonlyArray<EntryReplacement>
  ): Promise<IndexTree> {
    const buckets = new Map<string, Array<IndexTreeLeaf>>()
    const versions = new Set<string>()
    for (const replacement of entries) {
      const indexed = entryIndexRow(replacement.entry)
      const versionId = indexed.versionId
      if (versions.has(versionId))
        throw new Error(`Duplicate indexed entry: ${versionId}`)
      versions.add(versionId)
      const bucket = bucketKey(versionId)
      const leaves = buckets.get(bucket) ?? []
      leaves.push({
        kind: 'entry',
        key: versionId,
        versionId,
        hash: JSON.stringify([
          versionId,
          indexed.rowHash,
          replacement.payloadId ?? null
        ])
      })
      buckets.set(bucket, leaves)
    }
    const children = await Promise.all(
      [...buckets]
        .sort(([a], [b]) => compare(a, b))
        .map(async ([key, leaves]) => {
          leaves.sort((a, b) => compare(a.key, b.key))
          return {
            kind: 'directory' as const,
            key,
            hash: await digest([
              'bucket',
              key,
              leaves.map(leaf => [leaf.key, leaf.hash])
            ]),
            children: leaves
          }
        })
    )
    return new IndexTree({
      kind: 'directory',
      key: '',
      hash: await digest([
        'root',
        children.map(child => [child.key, child.hash])
      ]),
      children
    })
  }

  diff(next: IndexTree): IndexTreeDelta {
    const replacements = new Set<string>()
    const removed = new Set<string>()
    if (this.root.hash !== next.root.hash) {
      const before = directories(this.root)
      const after = directories(next.root)
      for (const key of new Set([...before.keys(), ...after.keys()])) {
        const left = before.get(key)
        const right = after.get(key)
        if (left?.hash === right?.hash) continue
        compareLeaves(left, right, replacements, removed)
      }
    }
    return {
      fromHash: this.root.hash,
      toHash: next.root.hash,
      replacements: [...replacements].sort(compare),
      removedVersionIds: [...removed].sort(compare)
    }
  }
}

function directories(
  root: IndexTreeDirectory
): Map<string, IndexTreeDirectory> {
  return new Map(
    root.children.map(child => {
      if (child.kind !== 'directory') throw new Error('Invalid index tree root')
      return [child.key, child]
    })
  )
}

function compareLeaves(
  before: IndexTreeDirectory | undefined,
  after: IndexTreeDirectory | undefined,
  replacements: Set<string>,
  removed: Set<string>
): void {
  const left = new Map(
    before?.children.map(child => {
      if (child.kind !== 'entry') throw new Error('Invalid index tree bucket')
      return [child.versionId, child]
    })
  )
  const right = new Map(
    after?.children.map(child => {
      if (child.kind !== 'entry') throw new Error('Invalid index tree bucket')
      return [child.versionId, child]
    })
  )
  for (const versionId of new Set([...left.keys(), ...right.keys()])) {
    const previous = left.get(versionId)
    const next = right.get(versionId)
    if (previous?.hash === next?.hash) continue
    if (next) replacements.add(versionId)
    else removed.add(versionId)
  }
}

/** FNV-1a only chooses a stable bucket; SHA-256 directory hashes provide the
 * commitment. Hash collisions merely put more leaves in the same bucket. */
function bucketKey(key: string): string {
  let value = 0x811c9dc5
  for (const byte of new TextEncoder().encode(key)) {
    value ^= byte
    value = Math.imul(value, 0x01000193)
  }
  return (value >>> 24).toString(16).padStart(2, '0')
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const result = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(result), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}
