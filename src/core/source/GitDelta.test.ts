import {Blob, CompressionStream, Response} from '@alinea/iso'
import {suite} from '@alinea/suite'
import {$} from 'bun'
import {createHash} from 'node:crypto'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {applyGitDelta, createGitDelta} from './GitDelta.js'
import {hashBlob} from './GitUtils.js'
import {concatUint8Arrays, hexToBytes} from './Utils.js'

const test = suite(import.meta)

test('roundtrip create/apply git delta', () => {
  const base = bytes('abc123\nline2\nline3\n')
  const target = bytes('abc123\nline2 updated\nline3\nline4\n')

  const delta = createGitDelta(base, target)
  const applied = applyGitDelta(base, delta)
  test.equal(applied, target)
})

test('encodes large copy offsets and sizes', () => {
  // Offsets and sizes past 16 bits use the offset2, offset3 and size2 bytes
  const cases = [
    [70_000, 70_123],
    [0, 70_500],
    [16_800_000, 512]
  ]
  for (const [offset, size] of cases) {
    const base = new Uint8Array(offset + size + 16)
    for (let i = 0; i < size; i++)
      base[offset + i] = ((i * 13) ^ (i >>> 3)) & 0xff
    const target = base.slice(offset, offset + size)
    test.equal(applyGitDelta(base, createGitDelta(base, target)), target)
  }
})

test('git accepts pack containing our ref-delta', async () => {
  const base = bytes(`${'a'.repeat(4000)}\n${'b'.repeat(4000)}\n`)
  const target = bytes(`${'a'.repeat(4000)}\n${'c'.repeat(4000)}\nTAIL\n`)

  const baseSha = await hashBlob(base)
  const targetSha = await hashBlob(target)
  const delta = createGitDelta(base, target)

  const pack = await createPackWithRefDelta(baseSha, base, delta)

  const dir = await mkdtemp(join(tmpdir(), 'alinea-git-delta-'))
  try {
    await $`git init --bare`.cwd(dir).quiet()

    const packPath = join(dir, 'test.pack')
    await writeFile(packPath, pack)
    await $`git index-pack --strict --stdin < ${packPath}`.cwd(dir).quiet()

    const content = await $`git cat-file -p ${targetSha}`.cwd(dir).quiet()
    test.equal(new Uint8Array(content.stdout), target)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})

async function createPackWithRefDelta(
  baseSha: string,
  baseData: Uint8Array,
  deltaData: Uint8Array
): Promise<Uint8Array> {
  const header = new Uint8Array(12)
  header.set(bytes('PACK'), 0)
  writeUint32BE(header, 4, 2)
  writeUint32BE(header, 8, 2)

  const baseEntry = concatUint8Arrays([
    encodePackObjectHeader(3, baseData.length),
    await zlibCompress(baseData)
  ])

  const deltaEntry = concatUint8Arrays([
    encodePackObjectHeader(7, deltaData.length),
    hexToBytes(baseSha),
    await zlibCompress(deltaData)
  ])

  const payload = concatUint8Arrays([header, baseEntry, deltaEntry])
  const checksum = sha1Bytes(payload)
  return concatUint8Arrays([payload, checksum])
}

function encodePackObjectHeader(type: number, size: number): Uint8Array {
  const bytesOut: Array<number> = []
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

function sha1Bytes(data: Uint8Array): Uint8Array {
  const hash = createHash('sha1')
  hash.update(Buffer.from(data))
  return new Uint8Array(hash.digest())
}

function bytes(input: string): Uint8Array {
  return new TextEncoder().encode(input)
}

function writeUint32BE(target: Uint8Array, offset: number, value: number) {
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength)
  view.setUint32(offset, value, false)
}

async function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([data as Uint8Array<ArrayBuffer>])
  const compressed = new Response(
    blob.stream().pipeThrough(new CompressionStream('deflate'))
  )
  return new Uint8Array(await compressed.arrayBuffer())
}
