// Source: https://github.com/LinusU/array-buffer-to-hex/blob/fbff172a0d666d53ed95e65d19a6ee9b4009f1b9/index.js
export function arrayBufferToHex(arrayBuffer: ArrayBuffer) {
  const view = new Uint8Array(arrayBuffer)
  let result = '',
    value
  for (var i = 0; i < view.length; i++) {
    value = view[i].toString(16)
    result += value.length === 1 ? '0' + value : value
  }
  return result
}
