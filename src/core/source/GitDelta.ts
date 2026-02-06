import {assert} from '../util/Assert.js'

const MIN_MATCH = 4
const MAX_LITERAL = 0x7f
const MAX_COPY_SIZE = 0xffffff

/**
 * Creates Git-compatible delta data (the payload format used by OBJ_REF_DELTA
 * and OBJ_OFS_DELTA entries in pack files).
 */
export function createGitDelta(
  base: Uint8Array,
  target: Uint8Array
): Uint8Array {
  const out: Array<number> = []
  writeVarInt(base.length, out)
  writeVarInt(target.length, out)

  const index = buildBaseIndex(base)
  const literals: Array<number> = []

  let i = 0
  while (i < target.length) {
    const best = findBestMatch(base, target, i, index)
    if (!best || best.length < MIN_MATCH) {
      literals.push(target[i])
      i++
      if (literals.length === MAX_LITERAL) flushLiterals(literals, out)
      continue
    }

    flushLiterals(literals, out)

    let remaining = best.length
    let copyOffset = best.offset
    while (remaining > 0) {
      const chunkSize = Math.min(remaining, MAX_COPY_SIZE)
      writeCopyInstruction(copyOffset, chunkSize, out)
      copyOffset += chunkSize
      remaining -= chunkSize
    }

    i += best.length
  }

  flushLiterals(literals, out)
  return Uint8Array.from(out)
}

/**
 * Applies Git delta data onto a base object and returns the reconstructed
 * target object bytes.
 */
export function applyGitDelta(base: Uint8Array, delta: Uint8Array): Uint8Array {
  let pos = 0
  const [baseSize, baseSizePos] = readVarInt(delta, pos)
  pos = baseSizePos
  const [resultSize, resultSizePos] = readVarInt(delta, pos)
  pos = resultSizePos

  assert(baseSize === base.length, 'Git delta base size mismatch')

  const result = new Uint8Array(resultSize)
  let outPos = 0

  while (pos < delta.length) {
    const opcode = delta[pos++]
    if (opcode & 0x80) {
      let offset = 0
      let size = 0

      if (opcode & 0x01) offset |= delta[pos++]
      if (opcode & 0x02) offset |= delta[pos++] << 8
      if (opcode & 0x04) offset |= delta[pos++] << 16
      if (opcode & 0x08) offset |= delta[pos++] << 24

      if (opcode & 0x10) size |= delta[pos++]
      if (opcode & 0x20) size |= delta[pos++] << 8
      if (opcode & 0x40) size |= delta[pos++] << 16
      if (size === 0) size = 0x10000

      assert(offset >= 0 && offset + size <= base.length, 'Invalid delta copy')
      assert(outPos + size <= result.length, 'Delta expands beyond target size')

      result.set(base.subarray(offset, offset + size), outPos)
      outPos += size
      continue
    }

    assert(opcode !== 0, 'Invalid delta opcode 0')
    assert(pos + opcode <= delta.length, 'Invalid delta insert')
    assert(outPos + opcode <= result.length, 'Delta expands beyond target size')

    result.set(delta.subarray(pos, pos + opcode), outPos)
    pos += opcode
    outPos += opcode
  }

  assert(outPos === result.length, 'Delta result size mismatch')
  return result
}

function writeVarInt(value: number, out: Array<number>) {
  let n = value >>> 0
  while (true) {
    let byte = n & 0x7f
    n >>>= 7
    if (n !== 0) byte |= 0x80
    out.push(byte)
    if (n === 0) break
  }
}

function readVarInt(data: Uint8Array, start: number): [value: number, pos: number] {
  let shift = 0
  let value = 0
  let pos = start

  while (true) {
    assert(pos < data.length, 'Invalid varint')
    const byte = data[pos++]
    value |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
    assert(shift <= 28, 'Varint too large')
  }

  return [value >>> 0, pos]
}

function flushLiterals(literals: Array<number>, out: Array<number>) {
  if (literals.length === 0) return

  let pos = 0
  while (pos < literals.length) {
    const chunk = Math.min(MAX_LITERAL, literals.length - pos)
    out.push(chunk)
    for (let i = 0; i < chunk; i++) out.push(literals[pos + i])
    pos += chunk
  }

  literals.length = 0
}

function writeCopyInstruction(offset: number, size: number, out: Array<number>) {
  assert(size > 0, 'Invalid copy size')

  let opcode = 0x80
  const params: Array<number> = []

  const offset0 = offset & 0xff
  const offset1 = (offset >>> 8) & 0xff
  const offset2 = (offset >>> 16) & 0xff
  const offset3 = (offset >>> 24) & 0xff

  if (offset0 !== 0) {
    opcode |= 0x01
    params.push(offset0)
  }
  if (offset1 !== 0) {
    opcode |= 0x02
    params.push(offset1)
  }
  if (offset2 !== 0) {
    opcode |= 0x04
    params.push(offset2)
  }
  if (offset3 !== 0) {
    opcode |= 0x08
    params.push(offset3)
  }

  const size0 = size & 0xff
  const size1 = (size >>> 8) & 0xff
  const size2 = (size >>> 16) & 0xff

  if (size !== 0x10000) {
    if (size0 !== 0) {
      opcode |= 0x10
      params.push(size0)
    }
    if (size1 !== 0) {
      opcode |= 0x20
      params.push(size1)
    }
    if (size2 !== 0) {
      opcode |= 0x40
      params.push(size2)
    }
  }

  out.push(opcode)
  for (const byte of params) out.push(byte)
}

type BaseIndex = Map<number, Array<number>>

function buildBaseIndex(base: Uint8Array): BaseIndex {
  const index: BaseIndex = new Map()
  for (let i = 0; i + MIN_MATCH <= base.length; i++) {
    const key = key4(base, i)
    const list = index.get(key)
    if (list) {
      // keep only the most recent candidates; this bounds cost while still
      // finding good local matches.
      if (list.length >= 64) list.shift()
      list.push(i)
    } else {
      index.set(key, [i])
    }
  }
  return index
}

function findBestMatch(
  base: Uint8Array,
  target: Uint8Array,
  targetPos: number,
  index: BaseIndex
): {offset: number; length: number} | undefined {
  if (targetPos + MIN_MATCH > target.length) return undefined

  const key = key4(target, targetPos)
  const candidates = index.get(key)
  if (!candidates || candidates.length === 0) return undefined

  let bestOffset = 0
  let bestLength = 0

  for (let i = candidates.length - 1; i >= 0; i--) {
    const basePos = candidates[i]
    let length = 0

    while (
      basePos + length < base.length &&
      targetPos + length < target.length &&
      base[basePos + length] === target[targetPos + length]
    ) {
      length++
    }

    if (length > bestLength) {
      bestLength = length
      bestOffset = basePos
      if (bestLength >= MAX_COPY_SIZE) break
    }
  }

  if (bestLength < MIN_MATCH) return undefined
  return {offset: bestOffset, length: bestLength}
}

function key4(data: Uint8Array, pos: number): number {
  return (
    (data[pos] << 24) |
    (data[pos + 1] << 16) |
    (data[pos + 2] << 8) |
    data[pos + 3]
  )
}
