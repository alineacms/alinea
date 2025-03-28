export function assert(value: unknown, message?: string): asserts value {
  if (value) return
  const error = new Error(message)
  if ('captureStackTrace' in Error) Error.captureStackTrace(error, assert)
  throw error
}

/**
 * Computes the SHA-1 hash of the input data.
 */
export async function sha1Hash(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = new Uint8Array(hashBuffer)
  return bytesToHex(hashArray)
}

/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

const hexes = Array.from({length: 256}, (_, i) =>
  i.toString(16).padStart(2, '0')
)

/**
 * Converts a Uint8Array to a hexadecimal string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += hexes[bytes[i]]
  return hex
}

/**
 * Compares two strings for sorting.
 * See: https://stackoverflow.com/a/40355107/2168416
 */
export function compareStrings(a: string, b: string) {
  return -(a < b) || +(a > b)
}
