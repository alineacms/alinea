import {
  Blob,
  CompressionStream,
  DecompressionStream,
  Response
} from '@alinea/iso'
import {accumulate} from '../util/Async.js'
import {entries} from '../util/Objects.js'
import {MemorySource} from './MemorySource.js'
import type {Source} from './Source.js'
import {hashBlob} from './GitUtils.js'
import {ReadonlyTree, type Tree} from './Tree.js'
import {concatUint8Arrays} from './Utils.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const SOURCE_PACK_HEADER_SIZE = 40
const SOURCE_PACK_MAGIC = encoder.encode('ALINEAPK')
const SOURCE_PACK_VERSION = 1

export interface SourcePackObject {
  offset: number
  length: number
  rawLength: number
}

export interface SourcePackIndex {
  tree: Tree
  objects: Record<string, SourcePackObject>
}

export interface SourcePackHeader {
  indexOffset: number
  indexLength: number
  indexRawLength: number
}

async function compress(input: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([input as BlobPart])
  const stream = blob.stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function decompressSourcePackFrame(
  input: Uint8Array,
  rawLength: number
): Promise<Uint8Array> {
  const blob = new Blob([input as BlobPart])
  const stream = blob.stream().pipeThrough(new DecompressionStream('deflate'))
  const result = new Uint8Array(await new Response(stream).arrayBuffer())
  if (result.byteLength !== rawLength)
    throw new Error('Invalid Alinea source pack frame length')
  return result
}

function safeNumber(value: bigint): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0)
    throw new Error('Alinea source pack offset is out of range')
  return number
}

export function parseSourcePackHeader(input: Uint8Array): SourcePackHeader {
  if (input.byteLength < SOURCE_PACK_HEADER_SIZE)
    throw new Error('Invalid Alinea source pack header')
  for (let index = 0; index < SOURCE_PACK_MAGIC.length; index++) {
    if (input[index] !== SOURCE_PACK_MAGIC[index])
      throw new Error('Invalid Alinea source pack magic')
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength)
  const version = view.getUint32(8, true)
  if (version !== SOURCE_PACK_VERSION)
    throw new Error(`Unsupported Alinea source pack version: ${version}`)
  return {
    indexOffset: safeNumber(view.getBigUint64(16, true)),
    indexLength: safeNumber(view.getBigUint64(24, true)),
    indexRawLength: safeNumber(view.getBigUint64(32, true))
  }
}

export async function parseSourcePackIndex(
  input: Uint8Array,
  rawLength: number
): Promise<SourcePackIndex> {
  const raw = await decompressSourcePackFrame(input, rawLength)
  const parsed = JSON.parse(decoder.decode(raw)) as SourcePackIndex
  if (!parsed || typeof parsed !== 'object' || !parsed.tree || !parsed.objects)
    throw new Error('Invalid Alinea source pack index')
  return parsed
}

export async function exportSourcePack(source: Source): Promise<Uint8Array> {
  const tree = await source.getTree()
  const shas = Array.from(new Set(tree.index().values()))
  const blobs = new Map(await accumulate(source.getBlobs(shas)))
  const frames: Array<Uint8Array> = []
  const objects: Record<string, SourcePackObject> = {}
  let offset = SOURCE_PACK_HEADER_SIZE
  for (const sha of shas) {
    const blob = blobs.get(sha)
    if (!blob) throw new Error(`Missing source blob: ${sha}`)
    const frame = await compress(blob)
    objects[sha] = {
      offset,
      length: frame.byteLength,
      rawLength: blob.byteLength
    }
    frames.push(frame)
    offset += frame.byteLength
  }
  const indexRaw = encoder.encode(
    JSON.stringify({tree: tree.toJSON(), objects} satisfies SourcePackIndex)
  )
  const index = await compress(indexRaw)
  const header = new Uint8Array(SOURCE_PACK_HEADER_SIZE)
  header.set(SOURCE_PACK_MAGIC)
  const view = new DataView(header.buffer)
  view.setUint32(8, SOURCE_PACK_VERSION, true)
  view.setUint32(12, 0, true)
  view.setBigUint64(16, BigInt(offset), true)
  view.setBigUint64(24, BigInt(index.byteLength), true)
  view.setBigUint64(32, BigInt(indexRaw.byteLength), true)
  return concatUint8Arrays([header, ...frames, index])
}

export async function importSourcePack(
  input: Uint8Array
): Promise<MemorySource> {
  const header = parseSourcePackHeader(input)
  const indexEnd = header.indexOffset + header.indexLength
  if (indexEnd > input.byteLength)
    throw new Error('Alinea source pack index exceeds pack bounds')
  const index = await parseSourcePackIndex(
    input.subarray(header.indexOffset, indexEnd),
    header.indexRawLength
  )
  const blobs = new Map<string, Uint8Array>()
  for (const [sha, object] of entries(index.objects)) {
    const end = object.offset + object.length
    if (object.offset < SOURCE_PACK_HEADER_SIZE || end > header.indexOffset)
      throw new Error(`Alinea source pack object is out of bounds: ${sha}`)
    const blob = await decompressSourcePackFrame(
      input.subarray(object.offset, end),
      object.rawLength
    )
    if ((await hashBlob(blob)) !== sha)
      throw new Error(`Alinea source pack object hash mismatch: ${sha}`)
    blobs.set(sha, blob)
  }
  return new MemorySource(new ReadonlyTree(index.tree), blobs)
}
