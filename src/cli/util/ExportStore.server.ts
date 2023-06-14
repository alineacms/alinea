import {base64} from 'alinea/core/util/Encoding'
import {promises as fs} from 'node:fs'
import path, {dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

// Source: https://gist.github.com/miklund/79c1f3eb129ea5689c03c41d17922c14

function signedLEB128(value: number) {
  var v = [],
    size = Math.ceil(Math.log2(Math.abs(value))),
    more = true,
    isNegative = value < 0,
    b = 0
  while (more) {
    b = value & 127
    value = value >> 7

    if (isNegative) {
      value = value | -(1 << (size - 7))
    }
    if (
      (value == 0 && (b & 0x40) == 0) ||
      (value == -1 && (b & 0x40) == 0x40)
    ) {
      more = false
    } else {
      b = b | 128
    }
    v.push(b)
  }
  return Buffer.from(v)
}

function unsignedLEB128(value: number, padding?: number) {
  var v = [],
    b = 0
  padding = padding || 0
  do {
    b = value & 127
    value = value >> 7
    if (value != 0 || padding > 0) {
      b = b | 128
    }
    v.push(b)
    padding--
  } while (value != 0 || padding > -1)
  return Buffer.from(v)
}

const __dirname = dirname(fileURLToPath(import.meta.url))

function bin(strings: ReadonlyArray<string>, ...inserts: Array<Buffer>) {
  const res: Array<Buffer> = []
  strings.forEach(function (str, i) {
    res.push(
      Buffer.from(str.replace(/\/\/(.*?)\n/g, '').replace(/\s/g, ''), 'hex')
    )
    if (inserts[i]) res.push(inserts[i])
  })
  return Buffer.concat(res)
}

function embedInWasm(data: Uint8Array) {
  const size = unsignedLEB128(data.length)
  const length = signedLEB128(data.length)
  const globalL = unsignedLEB128(5 + length.length)
  const dataL = unsignedLEB128(5 + size.length + data.length)
  const memoryPages = unsignedLEB128(Math.ceil(data.length / 65536))
  const memoryL = unsignedLEB128(2 + memoryPages.length)
  return bin`
    00 61 73 6d                                         // WASM_BINARY_MAGIC
    01 00 00 00                                         // WASM_BINARY_VERSION
    05 ${memoryL} 01                                    // section "Memory" (5)
    00 ${memoryPages}                                   // memory 0
    06 ${globalL} 01 7f 00 41 ${length} 0b              // section "Global" (6)
    07 11 02 04 6461 7461 02 00 06 6c65 6e67 7468 03 00 // section "Export" (7)
    0b ${dataL} 01                                      // section "Data" (11)
    00 41 00 0b ${size}                                 // data segment header 0
    ${Buffer.from(data)}                                // data
  `
}

function embedInJs(source: string, data: Uint8Array) {
  return source.replace('$DB', base64.stringify(data))
}

export async function exportStore(
  data: Uint8Array,
  location: string,
  asWasm = false
) {
  const staticDir = path.join(__dirname, '../static')
  const source = await fs.readFile(
    path.join(staticDir, `store.${asWasm ? 'wasm' : 'embed'}.js`),
    'utf-8'
  )
  if (!asWasm) {
    await fs.writeFile(location, embedInJs(source, data))
  } else {
    await fs.writeFile(
      location,
      source.replace('$WASM', path.basename(location) + '.wasm')
    )
    await fs.writeFile(location + '.wasm', embedInWasm(data))
  }
}
