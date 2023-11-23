import {base16} from './Encoding.js'

// Source: https://github.com/LinusU/array-buffer-to-hex/blob/fbff172a0d666d53ed95e65d19a6ee9b4009f1b9/index.js
export function arrayBufferToHex(arrayBuffer: ArrayBuffer) {
  return base16.stringify(new Uint8Array(arrayBuffer), {pad: false})
}

export function concat(...arrays: Uint8Array[]) {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }
  return result
}
