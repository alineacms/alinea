import {assert} from '../util/Assert.js'
import type {Entry} from './Tree.js'
import {
  bytesToHex,
  compareStrings,
  concatUint8Arrays,
  hexToBytes,
  sha1Hash
} from './Utils.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Serializes a TreeData object into a Git tree object as a Uint8Array.
 */
export function serializeTreeEntries(entries: Array<Entry>): Uint8Array {
  const sortedEntries = entries.slice().sort(compareEntries)
  const entryBytesList = sortedEntries.map(entry => {
    const mode = entry.mode.startsWith('0') ? entry.mode.slice(1) : entry.mode
    const prefix = `${mode} ${entry.name}\0`
    const prefixBytes = encoder.encode(prefix)
    const sha1Bytes = hexToBytes(entry.sha)
    return new Uint8Array([...prefixBytes, ...sha1Bytes])
  })
  return concatUint8Arrays(entryBytesList)
}

/**
 * Compares two TreeEntry objects for sorting.
 */
function compareEntries(a: Entry, b: Entry) {
  const aName = a.entries ? `${a.name}/` : a.name
  const bName = b.entries ? `${b.name}/` : b.name
  return compareStrings(aName, bName)
}

/**
 * Parses a Git tree object from a Uint8Array into a TreeEntry object.
 */
export function parseTreeEntries(data: Uint8Array): Array<Entry> {
  let pos = 0
  const entries: Entry[] = []
  while (pos < data.length) {
    const spacePos = data.indexOf(0x20, pos) // Find space
    assert(spacePos > -1, 'Invalid tree entry: missing space')
    const mode = decoder.decode(data.slice(pos, spacePos)).padStart(6, '0')
    const nullPos = data.indexOf(0, spacePos)
    assert(nullPos > -1, 'Invalid tree entry: missing null byte')
    const name = decoder.decode(data.slice(spacePos + 1, nullPos))
    const sha1Start = nullPos + 1
    const sha1Bytes = data.slice(sha1Start, sha1Start + 20)
    const sha = bytesToHex(sha1Bytes)
    entries.push({
      sha,
      name,
      mode
    })
    pos = sha1Start + 20
  }
  return entries
}

/**
 * Computes the SHA-1 hash of a Git object from its type and content.
 */
export function hashObject(type: string, data: Uint8Array): Promise<string> {
  const header = `${type} ${data.length}\0`
  const headerBytes = encoder.encode(header)
  const blobObject = concatUint8Arrays([headerBytes, data])
  return sha1Hash(blobObject)
}

/**
 * Computes the SHA-1 hash of a serialized tree object.
 */
export function hashTree(serializedTree: Uint8Array): Promise<string> {
  return hashObject('tree', serializedTree)
}

/**
 * Computes the SHA-1 hash of a blob object from its content.
 */
export async function hashBlob(data: Uint8Array): Promise<string> {
  return hashObject('blob', data)
}
