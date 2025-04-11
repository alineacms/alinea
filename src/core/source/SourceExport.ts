import * as base64 from 'alinea/core/util/BufferToBase64'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import {MemorySource} from './MemorySource.js'
import type {Source} from './Source.js'
import {ReadonlyTree, type Tree} from './Tree.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface ExportedSource {
  tree: Tree
  blobs: string
}

export async function exportSource(source: Source): Promise<ExportedSource> {
  const tree = await source.getTree()
  const shas = Array.from(tree.index(), ([, sha]) => sha)
  const blobs = fromEntries(await source.getBlobs(shas))
  return {
    tree: tree.toJSON(),
    blobs: await base64.encode(encoder.encode(JSON.stringify(blobs)))
  }
}

export async function importSource(
  exported: ExportedSource
): Promise<MemorySource> {
  const tree = new ReadonlyTree(exported.tree)
  const blobs: Record<string, string> = JSON.parse(
    decoder.decode(await base64.decode(exported.blobs))
  )
  const source = new MemorySource(
    tree,
    new Map(
      entries(blobs).map(
        ([sha, contents]) => [sha, encoder.encode(contents)] as const
      )
    )
  )
  return source
}
