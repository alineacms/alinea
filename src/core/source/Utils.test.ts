import {expect, test} from 'bun:test'
import {bytesToHex, concatUint8Arrays, hexToBytes} from './Utils.js'

test('concat', () => {
  const concat = (...arrays: Array<Array<number>>) =>
    Array.from(concatUint8Arrays(arrays.map(array => new Uint8Array(array))))
  expect(concat()).toEqual([])
  expect(concat([1, 2, 3])).toEqual([1, 2, 3])
  expect(concat([1, 2], [3, 4, 5, 6], [7])).toEqual([1, 2, 3, 4, 5, 6, 7])
})

test('hex', () => {
  const bytes = new Uint8Array([255, 0, 127, 10])
  expect(bytesToHex(bytes)).toBe('ff007f0a')
  expect(hexToBytes('ff007f0a')).toEqual(bytes)
  expect(hexToBytes('')).toEqual(new Uint8Array())
  expect(() => hexToBytes('0102030')).toThrow('Invalid hex string')
})
