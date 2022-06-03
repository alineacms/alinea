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

// Regular expression to check formal correctness of base64 encoded strings
const b64re =
  /^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/

export function atob(input: string) {
  // atob can work with strings with whitespaces, even inside the encoded part,
  // but only \t, \n, \f, \r and ' ', which can be stripped.
  input = String(input).replace(/[\t\n\f\r ]+/g, '')
  if (!b64re.test(input))
    throw new TypeError(
      "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded."
    )

  // Adding the padding if missing, for semplicity
  input += '=='.slice(2 - (input.length & 3))
  var bitmap,
    result = '',
    r1,
    r2,
    i = 0
  for (; i < input.length; ) {
    bitmap =
      (b64.indexOf(input.charAt(i++)) << 18) |
      (b64.indexOf(input.charAt(i++)) << 12) |
      ((r1 = b64.indexOf(input.charAt(i++))) << 6) |
      (r2 = b64.indexOf(input.charAt(i++)))

    result +=
      r1 === 64
        ? String.fromCharCode((bitmap >> 16) & 255)
        : r2 === 64
        ? String.fromCharCode((bitmap >> 16) & 255, (bitmap >> 8) & 255)
        : String.fromCharCode(
            (bitmap >> 16) & 255,
            (bitmap >> 8) & 255,
            bitmap & 255
          )
  }
  return result
}
