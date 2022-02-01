import {createId} from '@alinea/core/Id'
import {Schema} from '@alinea/core/Schema'
import {Cache, JsonLoader} from '@alinea/server'
import {FileData} from '@alinea/server/data/FileData'
import {encode} from 'base64-arraybuffer'
import {dirname} from 'dirname-filename-esm'
import {build, BuildResult, Plugin} from 'esbuild'
import fs from 'fs-extra'
import {BetterSqlite3} from 'helder.store/sqlite/drivers/BetterSqlite3.js'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import {signed, unsigned} from 'leb128'
import {createRequire} from 'module'
import path from 'path'
import sade from 'sade'
import {version} from '../package.json'

const require = createRequire(import.meta.url)
const __dirname = dirname(import.meta)

const prog = sade('alinea')

function fail(message: string) {
  console.error(message)
  process.exit(1)
}

function failOnBuildError(build: Promise<BuildResult>) {
  return build.catch(error => {
    // Ignore build error because esbuild reports it to stderr
    process.exit(1)
  })
}

const externalPlugin: Plugin = {
  name: 'external',
  setup(build) {
    build.onResolve({filter: /^[^\.].*/}, args => {
      return {path: args.path, external: true}
    })
  }
}

type Options = {
  watch?: boolean
  schema?: string
  content?: string
  outdir?: string
}

function bin(strings: ReadonlyArray<String>, ...inserts: Array<Buffer>) {
  const res: Array<Buffer> = []
  strings.forEach(function (str, i) {
    res.push(
      Buffer.from(str.replace(/\/\/(.*?)\n/g, '').replace(/\s/g, ''), 'hex')
    )
    if (inserts[i]) res.push(inserts[i])
  })
  return Buffer.concat(res)
}

function embedInWasm(data: Buffer) {
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
    ${data}                                             // data
  `
}

async function embedInJs(source: string, data: Buffer) {
  const sqlJs = await fs.readFile(require.resolve('sql.js/dist/sql-wasm.wasm'))
  return source.replace('$DB', encode(data)).replace('$SQLJS', encode(sqlJs))
}

function schemaCollections(schema: Schema) {
  const types = schema.types
  const typeNames = Object.keys(types)
  return `
    export const Page = schema.entry
    ${typeNames
      .map(type => `export const ${type} = schema.collection('${type}')`)
      .join('\n')}
  `.trim()
}

function schemaTypes(location: string, schema: Schema) {
  const file = location.endsWith('.ts')
    ? location.substr(0, location.length - 3)
    : location
  const types = schema.types
  const typeNames = Object.keys(types)
  return `
    import {DataOf, EntryOf} from '@alinea/core'
    import {Collection} from 'helder.store'
    import {schema} from ${JSON.stringify(file)}
    export * from '../src/schema'
    export type Page = EntryOf<typeof schema>
    export const Page: Collection<Page>
    ${typeNames
      .map(
        type =>
          `export const ${type}: Collection<Extract<Page, {type: '${type}'}>>
          export type ${type} = DataOf<typeof ${type}>`
      )
      .join('\n')}
  `
    .replace(/  /g, '')
    .trim()
}

async function generate(options: Options) {
  const legacy = true
  const schemaLocation = options.schema || './src/schema.ts'
  const outdir = options.outdir || './.alinea'
  const content = options.content || './content'
  const cwd = process.cwd()
  if (!fs.existsSync(schemaLocation))
    return fail(`Schema file not found at "${schemaLocation}"`)
  await failOnBuildError(
    build({
      format: 'esm',
      target: 'esnext',
      outdir,
      entryPoints: [schemaLocation],
      bundle: true,
      platform: 'node',
      plugins: [externalPlugin]
    })
  )
  await fs.copy(path.join(__dirname, 'static'), outdir, {
    overwrite: true,
    filter(src, dest) {
      return (
        !src.includes('cache.legacy.js') && !src.includes('cache.modern.js')
      )
    }
  })
  const schemaFile = path.join(outdir, 'schema.js')
  const outFile = 'file://' + path.join(cwd, schemaFile)
  const exports = await import(outFile)
  const schema = exports.default || exports.schema
  const store = new SqliteStore(new BetterSqlite3(), createId)
  const source = new FileData({
    schema,
    fs: fs.promises,
    contentDir: content,
    loader: JsonLoader
  })
  await Cache.create(store, source)
  const db = (store as any).db.db
  const data = db.serialize()
  if (legacy) {
    const source = await fs.readFile(
      path.join(__dirname, 'static', 'cache.legacy.js'),
      'utf-8'
    )
    await fs.writeFile(
      path.join(outdir, 'cache.js'),
      await embedInJs(source, data)
    )
    // debug: await fs.writeFile(path.join(outdir, 'cache.db'), data)
  } else {
    await fs.copyFile(
      path.join(__dirname, 'static', 'cache.modern.js'),
      path.join(outdir, 'cache.js')
    )
    await fs.writeFile(path.join(outdir, 'cache.wasm'), embedInWasm(data))
  }
  const schemaSource = await fs.readFile(schemaFile, 'utf-8')
  await fs.writeFile(
    schemaFile,
    schemaSource + '\n' + schemaCollections(schema)
  )
  await fs.writeFile(
    path.join(outdir, 'schema.d.ts'),
    schemaTypes(
      path
        .relative(path.join(cwd, outdir), path.join(cwd, schemaLocation))
        .split(path.sep)
        .join('/'),
      schema
    )
  )
}

prog
  .version(version)
  .command('generate')
  .describe('Generate types and content cache')
  .option('-w, --watch', `Watch for changes to source files`)
  .option(
    '-s, --schema',
    `Location of the schema file, defaults to "./src/schema.ts"`
  )
  .option('-c, --content', `Content directory, defaults to "./content"`)
  .option('-o, --outdir', `Output directory, defaults to "./.alinea"`)
  .action(generate)

prog.parse(process.argv)
