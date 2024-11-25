import {
  Blob,
  CompressionStream,
  DecompressionStream,
  Response
} from '@alinea/iso'
// Source: https://github.com/WebReflection/buffer-to-base64

/**
 * Given a base64 string, optionally decompress it and returns its `ArrayBuffer` representation.
 * @param {string} btoa a previously encoded base64 representation of a buffer.
 * @param {CompressionFormat | ''} format an optional compression format with `deflate` as default.
 * @returns {Promise<ArrayBuffer>} the buffer representing the optionally decompressed base64.
 */
export const decode = (
  btoa: string,
  format: CompressionFormat | '' = 'deflate'
) => {
  for (
    var blob,
      str = atob(btoa),
      {length} = str,
      buffer = new Uint8Array(length),
      i = 0;
    i < length;
    i++
  )
    buffer[i] = str.charCodeAt(i)
  blob = new Blob([buffer])
  return (
    format
      ? new Response(blob.stream().pipeThrough(new DecompressionStream(format)))
      : blob
  ).arrayBuffer()
}

/**
 * Given a generic buffer, optionally compress it and returns its `base64` representation.
 * @param {ArrayBuffer | Uint8Array} buffer a generic buffer to optionally compress and return as base64.
 * @param {CompressionFormat | ''} format an optional compression format with `deflate` as default.
 * @returns {Promise<string>} the base64 representation of the optionally compressed buffer.
 */
export const encode = async (
  buffer: ArrayBuffer | Uint8Array,
  format: CompressionFormat | '' = 'deflate'
) => {
  for (
    var blob = new Blob([buffer]),
      res = format
        ? new Response(blob.stream().pipeThrough(new CompressionStream(format)))
        : blob,
      view = new Uint8Array(await res.arrayBuffer()),
      {fromCharCode} = String,
      {length} = view,
      out = '',
      c = 2000,
      i = 0;
    i < length;
    i += c
  )
    out += fromCharCode(...view.subarray(i, i + c))
  return btoa(out)
}
