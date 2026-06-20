import {Blob, CompressionStream, Response} from '@alinea/iso'
import {applyGitDelta} from 'alinea/core/source/GitDelta'
import {hashObject} from 'alinea/core/source/GitUtils'
import {
  bytesToHex,
  concatUint8Arrays,
  hexToBytes
} from 'alinea/core/source/Utils'
import {assert} from 'alinea/core/util/Assert'

export type GitObjectType = 'commit' | 'tree' | 'blob'

export interface PackObject {
  type: GitObjectType
  data: Uint8Array
}

interface ParsedObject extends PackObject {
  sha: string
  offset: number
}

export async function createPack(objects: Array<PackObject>): Promise<Uint8Array> {
  const header = new Uint8Array(12)
  header.set(new TextEncoder().encode('PACK'))
  writeUint32BE(header, 4, 2)
  writeUint32BE(header, 8, objects.length)
  const entries = await Promise.all(
    objects.map(async object => {
      const type = packTypeCode(object.type)
      return concatUint8Arrays([
        encodePackObjectHeader(type, object.data.length),
        await deflate(object.data)
      ])
    })
  )
  const payload = concatUint8Arrays([header, ...entries])
  const checksum = hexToBytes(await hashRaw(payload))
  return concatUint8Arrays([payload, checksum])
}

export async function parsePack(pack: Uint8Array): Promise<Array<ParsedObject>> {
  assert(pack.length >= 32, 'Invalid pack')
  assert(new TextDecoder().decode(pack.subarray(0, 4)) === 'PACK', 'Invalid pack')
  const version = readUint32BE(pack, 4)
  assert(version === 2 || version === 3, `Unsupported pack version ${version}`)
  const count = readUint32BE(pack, 8)
  let pos = 12
  const byOffset = new Map<number, ParsedObject>()
  const bySha = new Map<string, ParsedObject>()
  const parsed = Array<ParsedObject>()
  for (let i = 0; i < count; i++) {
    const offset = pos
    const header = parsePackObjectHeader(pack, pos)
    pos = header.pos
    let baseOffset: number | undefined
    let baseSha: string | undefined
    if (header.type === 6) {
      const parsedOffset = parseOfsDeltaOffset(pack, pos)
      pos = parsedOffset.pos
      baseOffset = offset - parsedOffset.distance
    } else if (header.type === 7) {
      baseSha = bytesToHex(pack.subarray(pos, pos + 20))
      pos += 20
    }
    const inflated = await inflateMember(pack, pos)
    pos += inflated.bytesConsumed
    let object: ParsedObject
    if (header.type === 6 || header.type === 7) {
      const base =
        baseOffset !== undefined ? byOffset.get(baseOffset) : bySha.get(baseSha!)
      assert(base, `Missing delta base for pack object at ${offset}`)
      const data = applyGitDelta(base.data, inflated.data)
      const sha = await hashObject(base.type, data)
      object = {offset, type: base.type, data, sha}
    } else {
      const type = parseObjectType(header.type)
      const sha = await hashObject(type, inflated.data)
      object = {offset, type, data: inflated.data, sha}
    }
    parsed.push(object)
    byOffset.set(offset, object)
    bySha.set(object.sha, object)
  }
  return parsed
}

function parseObjectType(type: number): GitObjectType {
  switch (type) {
    case 1:
      return 'commit'
    case 2:
      return 'tree'
    case 3:
      return 'blob'
    default:
      throw new Error(`Unsupported pack object type ${type}`)
  }
}

function packTypeCode(type: GitObjectType): number {
  switch (type) {
    case 'commit':
      return 1
    case 'tree':
      return 2
    case 'blob':
      return 3
  }
}

function encodePackObjectHeader(type: number, size: number): Uint8Array {
  const bytesOut = Array<number>()
  let n = size >>> 4
  let first = ((type & 0x07) << 4) | (size & 0x0f)
  if (n !== 0) first |= 0x80
  bytesOut.push(first)
  while (n !== 0) {
    let next = n & 0x7f
    n >>>= 7
    if (n !== 0) next |= 0x80
    bytesOut.push(next)
  }
  return Uint8Array.from(bytesOut)
}

function parsePackObjectHeader(pack: Uint8Array, offset: number) {
  let pos = offset
  let byte = pack[pos++]
  const type = (byte >> 4) & 0x07
  let size = byte & 0x0f
  let shift = 4
  while (byte & 0x80) {
    byte = pack[pos++]
    size |= (byte & 0x7f) << shift
    shift += 7
  }
  return {type, size, pos}
}

function parseOfsDeltaOffset(pack: Uint8Array, offset: number) {
  let pos = offset
  let byte = pack[pos++]
  let distance = byte & 0x7f
  while (byte & 0x80) {
    byte = pack[pos++]
    distance = ((distance + 1) << 7) | (byte & 0x7f)
  }
  return {distance, pos}
}

async function inflateMember(pack: Uint8Array, offset: number) {
  const {createInflate} = await import('node:zlib')
  const inflater = createInflate()
  const chunks = Array<Uint8Array>()
  inflater.on('data', chunk => chunks.push(new Uint8Array(chunk)))
  const source = Buffer.from(pack.subarray(offset))
  const end = new Promise<void>((resolve, reject) => {
    inflater.on('end', resolve)
    inflater.on('error', reject)
  })
  inflater.end(source)
  await end
  return {
    data: concatUint8Arrays(chunks),
    bytesConsumed: inflater.bytesWritten
  }
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([data])
  const compressed = new Response(
    blob.stream().pipeThrough(new CompressionStream('deflate'))
  )
  return new Uint8Array(await compressed.arrayBuffer())
}

async function hashRaw(data: Uint8Array): Promise<string> {
  const {sha1Hash} = await import('alinea/core/source/Utils')
  return sha1Hash(data)
}

function writeUint32BE(target: Uint8Array, offset: number, value: number) {
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength)
  view.setUint32(offset, value, false)
}

function readUint32BE(target: Uint8Array, offset: number) {
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength)
  return view.getUint32(offset, false)
}
