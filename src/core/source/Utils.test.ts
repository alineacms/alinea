import {expect, it} from 'bun:test'
import {bytesToHex, concatUint8Arrays, hexToBytes, sha1Hash} from './Utils.js'

it('should handle empty Uint8Array', async () => {
  const data = new Uint8Array([])
  const expectedHash = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
  const hash = await sha1Hash(data)
  expect(hash).toBe(expectedHash)
})

it('should handle larger Uint8Arrays', async () => {
  const data = new Uint8Array(1024).map(() => Math.floor(Math.random() * 256))
  const hash = await sha1Hash(data)
  expect(hash).toMatch(/^[0-9a-f]{40}$/) // Check if it's a valid SHA-1 hash
})

it('should concatenate Uint8Arrays correctly', () => {
  const arr1 = new Uint8Array([1, 2, 3])
  const arr2 = new Uint8Array([4, 5, 6])
  const result = concatUint8Arrays([arr1, arr2])
  expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6])
})

it('should handle empty arrays', () => {
  const result = concatUint8Arrays([])
  expect(result.length).toBe(0)
})

it('should handle single array', () => {
  const arr1 = new Uint8Array([1, 2, 3])
  const result = concatUint8Arrays([arr1])
  expect(Array.from(result)).toEqual([1, 2, 3])
})

it('should handle multiple arrays of varying lengths', () => {
  const arr1 = new Uint8Array([1, 2])
  const arr2 = new Uint8Array([3, 4, 5, 6])
  const arr3 = new Uint8Array([7])
  const result = concatUint8Arrays([arr1, arr2, arr3])
  expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6, 7])
})

it('should convert a valid hexadecimal string to a Uint8Array', () => {
  const hex = '01020304'
  const result = hexToBytes(hex)
  expect(Array.from(result)).toEqual([1, 2, 3, 4])
})

it('should throw an error for an invalid hexadecimal string (odd length)', () => {
  const hex = '0102030'
  expect(() => hexToBytes(hex)).toThrow('Invalid hex string')
})

it('should handle empty hex string', () => {
  const hex = ''
  const result = hexToBytes(hex)
  expect(result.length).toBe(0)
})

it('should convert a larger hex string', () => {
  const hex = '0102030405060708090a0b0c0d0e0f10'
  const result = hexToBytes(hex)
  expect(Array.from(result)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
  ])
})

it('should convert a Uint8Array to a hexadecimal string', () => {
  const bytes = new Uint8Array([1, 2, 3, 4])
  const result = bytesToHex(bytes)
  expect(result).toBe('01020304')
})

it('should handle an empty Uint8Array', () => {
  const bytes = new Uint8Array([])
  const result = bytesToHex(bytes)
  expect(result).toBe('')
})

it('should handle Uint8Array with max value', () => {
  const bytes = new Uint8Array([255, 0, 127])
  const result = bytesToHex(bytes)
  expect(result).toBe('ff007f')
})
