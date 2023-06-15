// Source: https://github.com/swansontec/rfc4648.js/blob/ead9c9b4b68e5d4a529f32925da02c02984e772c/src/index.ts
// Copyright © 2022 William R Swanson

export interface Encoding {
  bits: number
  chars: string
  codes?: {[char: string]: number}
}

export interface ParseOptions {
  loose?: boolean
  out?: new (size: number) => {[index: number]: number}
}

export interface StringifyOptions {
  pad?: boolean
}

export function parse(
  string: string,
  encoding: Encoding,
  opts: ParseOptions = {}
): Uint8Array {
  // Build the character lookup table:
  if (!encoding.codes) {
    encoding.codes = {}
    for (let i = 0; i < encoding.chars.length; ++i) {
      encoding.codes[encoding.chars[i]] = i
    }
  }

  // The string must have a whole number of bytes:
  if (!opts.loose && (string.length * encoding.bits) & 7) {
    throw new SyntaxError('Invalid padding')
  }

  // Count the padding bytes:
  let end = string.length
  while (string[end - 1] === '=') {
    --end

    // If we get a whole number of bytes, there is too much padding:
    if (!opts.loose && !(((string.length - end) * encoding.bits) & 7)) {
      throw new SyntaxError('Invalid padding')
    }
  }

  // Allocate the output:
  const out = new (opts.out ?? Uint8Array)(
    ((end * encoding.bits) / 8) | 0
  ) as Uint8Array

  // Parse the data:
  let bits = 0 // Number of bits currently in the buffer
  let buffer = 0 // Bits waiting to be written out, MSB first
  let written = 0 // Next byte to write
  for (let i = 0; i < end; ++i) {
    // Read one character from the string:
    const value = encoding.codes[string[i]]
    if (value === undefined) {
      throw new SyntaxError('Invalid character ' + string[i])
    }

    // Append the bits to the buffer:
    buffer = (buffer << encoding.bits) | value
    bits += encoding.bits

    // Write out some bits if the buffer has a byte's worth:
    if (bits >= 8) {
      bits -= 8
      out[written++] = 0xff & (buffer >> bits)
    }
  }

  // Verify that we have received just enough bits:
  if (bits >= encoding.bits || 0xff & (buffer << (8 - bits))) {
    throw new SyntaxError('Unexpected end of data')
  }

  return out
}

export function stringify(
  data: ArrayLike<number>,
  encoding: Encoding,
  opts: StringifyOptions = {}
): string {
  const {pad = true} = opts
  const mask = (1 << encoding.bits) - 1
  let out = ''

  let bits = 0 // Number of bits currently in the buffer
  let buffer = 0 // Bits waiting to be written out, MSB first
  for (let i = 0; i < data.length; ++i) {
    // Slurp data into the buffer:
    buffer = (buffer << 8) | (0xff & data[i])
    bits += 8

    // Write out as much as we can:
    while (bits > encoding.bits) {
      bits -= encoding.bits
      out += encoding.chars[mask & (buffer >> bits)]
    }
  }

  // Partial character:
  if (bits) {
    out += encoding.chars[mask & (buffer << (encoding.bits - bits))]
  }

  // Add padding characters until we hit a byte boundary:
  if (pad) {
    while ((out.length * encoding.bits) & 7) {
      out += '='
    }
  }

  return out
}

const base16Encoding: Encoding = {
  chars: '0123456789ABCDEF',
  bits: 4
}

const base32Encoding: Encoding = {
  chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  bits: 5
}

const base32HexEncoding: Encoding = {
  chars: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
  bits: 5
}

const base64Encoding: Encoding = {
  chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  bits: 6
}

const base64UrlEncoding: Encoding = {
  chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  bits: 6
}

const base85Encoding: Encoding = {
  chars:
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~',
  bits: 7
}

export const base16 = {
  parse(string: string, opts?: ParseOptions): Uint8Array {
    return parse(string.toUpperCase(), base16Encoding, opts)
  },

  stringify(data: ArrayLike<number>, opts?: StringifyOptions): string {
    return stringify(data, base16Encoding, opts)
  }
}

export const base32 = {
  parse(string: string, opts: ParseOptions = {}): Uint8Array {
    return parse(
      opts.loose
        ? string
            .toUpperCase()
            .replace(/0/g, 'O')
            .replace(/1/g, 'L')
            .replace(/8/g, 'B')
        : string,
      base32Encoding,
      opts
    )
  },

  stringify(data: ArrayLike<number>, opts?: StringifyOptions): string {
    return stringify(data, base32Encoding, opts)
  }
}

export const base32hex = {
  parse(string: string, opts?: ParseOptions): Uint8Array {
    return parse(string, base32HexEncoding, opts)
  },

  stringify(data: ArrayLike<number>, opts?: StringifyOptions): string {
    return stringify(data, base32HexEncoding, opts)
  }
}

export const base64 = {
  parse(string: string, opts?: ParseOptions): Uint8Array {
    return parse(string, base64Encoding, opts)
  },

  stringify(data: ArrayLike<number>, opts?: StringifyOptions): string {
    return stringify(data, base64Encoding, opts)
  }
}

export const base64url = {
  parse(string: string, opts?: ParseOptions): Uint8Array {
    return parse(string, base64UrlEncoding, opts)
  },

  stringify(data: ArrayLike<number>, opts?: StringifyOptions): string {
    return stringify(data, base64UrlEncoding, opts)
  }
}

export const base85 = {
  parse(string: string, opts?: ParseOptions): Uint8Array {
    return parse(string, base85Encoding, opts)
  },

  stringify(data: ArrayLike<number>, opts?: StringifyOptions): string {
    return stringify(data, base85Encoding, opts)
  }
}

export const codec = {parse, stringify}

export function btoa(input: string) {
  return base64.stringify(new TextEncoder().encode(input))
}

export function atob(input: string) {
  input = String(input).replace(/[\t\n\f\r ]+/g, '')
  return new TextDecoder().decode(base64.parse(input))
}
