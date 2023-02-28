import {base16} from './Encoding.js'

// Source: https://github.com/LinusU/array-buffer-to-hex/blob/fbff172a0d666d53ed95e65d19a6ee9b4009f1b9/index.js
export function arrayBufferToHex(arrayBuffer: ArrayBuffer) {
  return base16.stringify(new Uint8Array(arrayBuffer), {pad: false})
}
