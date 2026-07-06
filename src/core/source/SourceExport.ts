import * as base64 from 'alinea/core/util/BufferToBase64'
import {accumulate} from '../util/Async.js'
import {MemorySource} from './MemorySource.js'
import type {Source} from './Source.js'
import {ReadonlyTree, type Tree} from './Tree.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface ExportedSource {
  tree: Tree
  blobs?: string
  blobChunks?: Array<string>
}

export async function exportSource(source: Source): Promise<ExportedSource> {
  const tree = await source.getTree()
  const blobs = await sourceBlobTexts(source, tree)
  return {
    tree: tree.toJSON(),
    blobs: await encodeBlobMap(blobs)
  }
}

export async function exportSourceChunks(
  source: Source,
  {targetBytes = 2 * 1024 * 1024}: {targetBytes?: number} = {}
): Promise<ExportedSource> {
  const tree = await source.getTree()
  const chunks = Array<string>()
  let chunk: Record<string, string> = {}
  let chunkBytes = 0
  for (const [sha, text] of await sourceBlobTextEntries(source, tree)) {
    const entryBytes = sha.length + text.length + 8
    if (chunkBytes > 0 && chunkBytes + entryBytes > targetBytes) {
      chunks.push(await encodeBlobMap(chunk))
      chunk = {}
      chunkBytes = 0
    }
    chunk[sha] = text
    chunkBytes += entryBytes
  }
  if (chunkBytes > 0) chunks.push(await encodeBlobMap(chunk))
  return {
    tree: tree.toJSON(),
    blobChunks: chunks
  }
}

async function sourceBlobTextEntries(source: Source, tree: ReadonlyTree) {
  const shas = Array.from(tree.index(), ([, sha]) => sha)
  const fromSource = await accumulate(source.getBlobs(shas))
  return fromSource.map(([sha, blob]) => [sha, decoder.decode(blob)] as const)
}

async function sourceBlobTexts(source: Source, tree: ReadonlyTree) {
  const blobs: Record<string, string> = {}
  for (const [sha, text] of await sourceBlobTextEntries(source, tree))
    blobs[sha] = text
  return blobs
}

async function encodeBlobMap(blobs: Record<string, string>) {
  return base64.encode(encoder.encode(JSON.stringify(blobs)))
}

export async function importSource(
  exported: ExportedSource
): Promise<MemorySource> {
  const tree = new ReadonlyTree(exported.tree)
  const blobMap = new Map<string, string>()
  if (exported.blobChunks) {
    for (const chunk of exported.blobChunks) {
      const blobs = await decodeBlobMap(chunk)
      for (const sha in blobs) blobMap.set(sha, blobs[sha])
    }
  } else {
    const blobs = await decodeBlobMap(exported.blobs!)
    for (const sha in blobs) blobMap.set(sha, blobs[sha])
  }
  const source = MemorySource.fromTexts(tree, blobMap)
  return source
}

async function decodeBlobMap(encoded: string): Promise<Record<string, string>> {
  return JSON.parse(decoder.decode(await base64.decode(encoded)))
}
