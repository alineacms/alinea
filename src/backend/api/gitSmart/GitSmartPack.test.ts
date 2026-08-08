import {Blob, CompressionStream, Response} from '@alinea/iso'
import {suite} from '@alinea/suite'
import {createGitDelta} from 'alinea/core/source/GitDelta'
import {hashBlob} from 'alinea/core/source/GitUtils'
import {sha1Bytes} from 'alinea/core/source/Utils'
import {parsePack, createPack} from './GitSmartPack.js'

const test = suite(import.meta)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

test('createPack and parsePack roundtrip full objects', async () => {
  const objects = [
    {type: 'blob' as const, data: encoder.encode('hello')},
    {type: 'tree' as const, data: encoder.encode('040000 dir\0')},
    {type: 'commit' as const, data: encoder.encode('tree abc\n\nmsg')}
  ]
  const pack = await createPack(objects)
  const parsed = await parsePack(pack)
  test.equal(
    parsed.map(object => object.type),
    ['blob', 'tree', 'commit']
  )
  test.equal(
    parsed.map(object => decoder.decode(object.data)),
    ['hello', '040000 dir\0', 'tree abc\n\nmsg']
  )
})

test('parsePack decodes ref-delta blobs', async () => {
  const base = encoder.encode('abc123\nline2\nline3\n')
  const target = encoder.encode('abc123\nline2 updated\nline3\nline4\n')
  const pack = await createRefDeltaPack(base, target)
  const parsed = await parsePack(pack)
  test.is(parsed.length, 2)
  test.is(parsed[0].type, 'blob')
  test.is(parsed[1].type, 'blob')
  test.is(decoder.decode(parsed[1].data), decoder.decode(target))
  test.is(parsed[1].sha, await hashBlob(target))
})

async function createRefDeltaPack(base: Uint8Array, target: Uint8Array) {
  const {hexToBytes} = await import('alinea/core/source/Utils')
  const baseSha = await hashBlob(base)
  const delta = createGitDelta(base, target)
  const header = new Uint8Array(12)
  header.set(encoder.encode('PACK'), 0)
  new DataView(header.buffer).setUint32(4, 2, false)
  new DataView(header.buffer).setUint32(8, 2, false)
  const baseEntry = concat([
    encodeHeader(3, base.length),
    await compressed(base)
  ])
  const deltaEntry = concat([
    encodeHeader(7, delta.length),
    hexToBytes(baseSha),
    await compressed(delta)
  ])
  const payload = concat([header, baseEntry, deltaEntry])
  return concat([payload, await sha1Bytes(payload)])
}

function encodeHeader(type: number, size: number) {
  const bytes = Array<number>()
  let n = size >>> 4
  let first = ((type & 0x07) << 4) | (size & 0x0f)
  if (n !== 0) first |= 0x80
  bytes.push(first)
  while (n !== 0) {
    let next = n & 0x7f
    n >>>= 7
    if (n !== 0) next |= 0x80
    bytes.push(next)
  }
  return Uint8Array.from(bytes)
}

async function compressed(data: Uint8Array) {
  const blob = new Blob([data])
  const response = new Response(
    blob.stream().pipeThrough(new CompressionStream('deflate'))
  )
  return new Uint8Array(await response.arrayBuffer())
}

function concat(parts: Array<Uint8Array>) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
