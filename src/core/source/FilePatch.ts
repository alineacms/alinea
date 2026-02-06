import {assert} from '../util/Assert.js'
import {applyGitDelta, createGitDelta} from './GitDelta.js'
import {sha1Bytes as computeSha1Bytes} from './Utils.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const HASH_BYTES = 20

/**
 * Creates a Git-delta based patch for transforming `base` into `updated`.
 * Format:
 * - 20 bytes: SHA-1(base)
 * - N bytes: Git delta payload
 * - 20 bytes: SHA-1(updated)
 */
export async function createFilePatch(
  base: string,
  updated: string
): Promise<Uint8Array> {
  const baseBytes = encoder.encode(base)
  const updatedBytes = encoder.encode(updated)
  const delta = createGitDelta(baseBytes, updatedBytes)
  const [baseHash, updatedHash] = await Promise.all([
    computeSha1Bytes(baseBytes),
    computeSha1Bytes(updatedBytes)
  ])

  const out = new Uint8Array(HASH_BYTES + delta.length + HASH_BYTES)
  out.set(baseHash, 0)
  out.set(delta, HASH_BYTES)
  out.set(updatedHash, HASH_BYTES + delta.length)
  return out
}

/**
 * Applies a patch created by `createFilePatch` and returns the updated string.
 */
export async function applyFilePatch(
  base: string,
  patch: Uint8Array
): Promise<string> {
  assert(patch.length >= HASH_BYTES * 2, 'Invalid patch: too small')

  const baseBytes = encoder.encode(base)
  const expectedBaseHash = patch.subarray(0, HASH_BYTES)
  const actualBaseHash = await computeSha1Bytes(baseBytes)
  assert(bytesEqual(expectedBaseHash, actualBaseHash), 'Patch does not match base')

  const delta = patch.subarray(HASH_BYTES, patch.length - HASH_BYTES)
  const result = applyGitDelta(baseBytes, delta)

  const expectedHash = patch.subarray(patch.length - HASH_BYTES)
  const actualHash = await computeSha1Bytes(result)
  assert(bytesEqual(actualHash, expectedHash), 'Patched content hash mismatch')

  return decoder.decode(result)
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
