// cyrb53 by bryc (public domain), a fast 53 bit string hash
function cyrb53(input: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ char, 2654435761)
    h2 = Math.imul(h2 ^ char, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/**
 * Derive an id from the position of a value within an entry, so parsing the
 * same file always produces the same ids. The id is 22 lowercase
 * alphanumeric characters (two 53 bit hashes).
 */
export function stableId(path: ReadonlyArray<string>): string {
  const input = JSON.stringify(path)
  return hash(input, 0) + hash(input, 1)
}

function hash(input: string, seed: number): string {
  return cyrb53(input, seed).toString(36).padStart(11, '0')
}
