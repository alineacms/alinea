// Source: https://github.com/ValeriaVG/xksuid/tree/main

import {crypto} from '@alinea/iso'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
/**
 * Encodes buffer to base62
 * @param {DataView} view
 * @returns {string}
 */
function base62(view: DataView) {
  if (view.byteLength !== 20) {
    throw new Error('incorrect buffer size')
  }
  const str = new Array(27).fill('0')
  let n = 27
  let bp = new Array(5)
  bp[0] = view.getUint32(0, false)
  bp[1] = view.getUint32(4, false)
  bp[2] = view.getUint32(8, false)
  bp[3] = view.getUint32(12, false)
  bp[4] = view.getUint32(16, false)

  const srcBase = 4294967296n
  const dstBase = 62n

  while (bp.length !== 0) {
    const quotient = []
    let remainder = 0

    for (const c of bp) {
      const value = BigInt(c) + BigInt(remainder) * srcBase

      const digit = value / dstBase

      remainder = Number(value % dstBase)

      if (quotient.length !== 0 || digit !== 0n) {
        quotient.push(Number(digit))
      }
    }

    // Writes at the end of the destination buffer because we computed the
    // lowest bits first.
    n--
    str[n] = BASE62.charAt(remainder)
    bp = quotient
  }
  return str.join('')
}

/**
 * Decodes base62 string to buffer
 * @param {string} str
 * @returns {Uint8Array} buffer
 */
function debase62(str: string) {
  if (str.length !== 27)
    throw new Error('Expected 27 characters long base62 string')
  const srcBase = 62n
  const dstBase = 4294967296n
  let bp = new Array(27)
  const dst = new Uint8Array(20)
  for (let i = 0; i < str.length; i++) {
    bp[i] = str.charCodeAt(i)
    // 0-9
    if (bp[i] >= 48 && bp[i] <= 57) {
      bp[i] -= 48 // '0'
      continue
    }
    // 10-35
    if (bp[i] >= 65 && bp[i] <= 90) {
      bp[i] = 10 + (bp[i] - 65)
      continue
    }
    // 36-61
    if (bp[i] >= 97 && bp[i] <= 122) {
      bp[i] = 36 + (bp[i] - 97)
      continue
    }
    throw new Error(`Unexpected symbol "${str.charAt(i)}"`)
  }
  let n = 20
  while (bp.length !== 0) {
    const quotient = []
    let remainder = 0n

    for (const c of bp) {
      const value = BigInt(c) + BigInt(remainder) * srcBase
      const digit = value / dstBase
      remainder = value % dstBase

      if (quotient.length !== 0 || digit !== 0n) {
        quotient.push(Number(digit))
      }
    }

    if (n < 4) {
      throw new Error('short buffer')
    }

    dst[n - 4] = Number(remainder) >> 24
    dst[n - 3] = Number(remainder) >> 16
    dst[n - 2] = Number(remainder) >> 8
    dst[n - 1] = Number(remainder)
    n -= 4
    bp = quotient
  }

  return dst
}

/**
 * Converts UNIX timestamp to (x)KSUID epoch timestamp
 * @param {number} timestamp ms
 * @param {boolean|undefined} desc order, `true` indicates xKSUID
 * @returns {number} seconds
 */
function toEpoch(timestamp: number, desc?: boolean) {
  if (!desc) {
    return Math.round(timestamp / 1000) - 14e8
  }
  return 4294967295 - (Math.round(timestamp / 1000) - 14e8)
}

/**
 * Converts (x)KSUID epoch timestamp to UNIX timestamp
 * @param {number} timestamp s
 * @param {boolean|undefined} desc
 * @returns {number} ms
 */
function fromEpoch(timestamp: number, desc: boolean) {
  if (!desc) {
    return (14e8 + timestamp) * 1000
  }
  return (4294967295 - timestamp + 14e8) * 1000
}

/**
 * Generates cryptographically strong random buffer
 * @returns {Uint8Array} 16 bytes of random binary values
 */
function randomBytes() {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Generates new (x)KSUID based on current timestamp
 * @param {boolean} desc
 * @param {number} timestamp ms
 * @returns {string} 27 chars KSUID or 28 chars for xKSUID
 */
function generate(desc = false, timestamp = Date.now()) {
  const buf = new ArrayBuffer(20)
  const view = new DataView(buf)
  const ts = toEpoch(timestamp, desc)
  let offset = 0
  view.setUint32(offset, ts, false)
  offset += 4
  const rnd = randomBytes()
  for (const b of rnd) {
    view.setUint8(offset++, b)
  }
  if (desc) return `z${base62(view)}`
  return base62(view)
}

/**
 * Parses (x)KSUID string to timestamp and random part
 * @param {string} ksuid
 * @return {{ts:Date,rnd:ArrayBuffer}} parsed value
 */
function parse(ksuid: string) {
  if (ksuid.length > 28 || ksuid.length < 27) {
    throw new Error(`Incorrect length: ${ksuid.length}, expected 27 or 28`)
  }
  const desc = ksuid.length === 28 && ksuid[0] === 'z'
  if (ksuid.length === 28 && ksuid[0] !== 'z') {
    throw new Error(`KSUID is 28 symbol, but first char is not "z"`)
  }
  const buf = debase62(desc ? ksuid.slice(1, 28) : ksuid)
  const view = new DataView(buf.buffer)
  const tsValue = view.getUint32(0, false)
  const ts = new Date(fromEpoch(tsValue, desc))
  return {ts, rnd: buf.buffer.slice(4)}
}

export function createId() {
  return generate()
}
