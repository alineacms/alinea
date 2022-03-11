// Source: https://github.com/MaxArt2501/base64-js/blob/39729b0e836f86398d6ebf1fb6d70c9f307bec0b/base64.js

// base64 character set, plus padding character (=)
const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

export function btoa(input: string) {
  var bitmap,
    a,
    b,
    c,
    result = '',
    i = 0,
    rest = input.length % 3 // To determine the final padding

  for (; i < input.length; ) {
    if (
      (a = input.charCodeAt(i++)) > 255 ||
      (b = input.charCodeAt(i++)) > 255 ||
      (c = input.charCodeAt(i++)) > 255
    )
      throw new TypeError(
        "Failed to execute 'btoa' on 'Window': The string to be encoded contains characters outside of the Latin1 range."
      )

    bitmap = (a << 16) | (b << 8) | c
    result +=
      b64.charAt((bitmap >> 18) & 63) +
      b64.charAt((bitmap >> 12) & 63) +
      b64.charAt((bitmap >> 6) & 63) +
      b64.charAt(bitmap & 63)
  }

  // If there's need of padding, replace the last 'A's with equal signs
  return rest ? result.slice(0, rest - 3) + '==='.substring(rest) : result
}
