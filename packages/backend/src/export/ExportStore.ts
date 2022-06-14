import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {encode} from 'base64-arraybuffer'
import {promises as fs} from 'node:fs'
import {signed, unsigned} from 'leb128'
import path, {dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

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
  const size = unsigned.encode(data.length)
  const length = signed.encode(data.length)
  const globalL = unsigned.encode(5 + length.length)
  const dataL = unsigned.encode(5 + size.length + data.length)
  const memoryPages = unsigned.encode(Math.ceil(data.length / 65536))
  const memoryL = unsigned.encode(2 + memoryPages.length)
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
  return source.replace('$DB', encode(data))
}

export async function exportStore(
  store: SqliteStore,
  location: string,
  asWasm = false
) {
  const data = store.export()
  const staticDir = path.join(__dirname, 'static')
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
