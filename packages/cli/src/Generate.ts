import {Cache, Data, JsonLoader} from '@alinea/backend'
import {FileData} from '@alinea/backend/data/FileData'
import {outcome} from '@alinea/core'
import {Config} from '@alinea/core/Config'
import {createId} from '@alinea/core/Id'
import {Schema} from '@alinea/core/Schema'
import {BetterSqlite3Driver} from '@alinea/store/sqlite/drivers/BetterSqlite3Driver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {encode} from 'base64-arraybuffer'
import Database from 'better-sqlite3'
import {dirname} from 'dirname-filename-esm'
import {build, BuildResult, Plugin} from 'esbuild'
import fs from 'fs-extra'
import {signed, unsigned} from 'leb128'
import path from 'node:path'

const __dirname = dirname(import.meta)

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
      if (args.kind === 'entry-point') return
      return {path: args.path, external: true}
    })
  }
}

const ignorePlugin: Plugin = {
  name: 'ignore',
  setup(build) {
    const commonExtensions = [
      'css',
      'html',
      'json',
      'css',
      'scss',
      'less',
      'png',
      'jpg',
      'gif',
      'svg'
    ]
    const filter = new RegExp(
      `(${commonExtensions.map(ext => `\\.${ext}`).join('|')})$`
    )
    build.onLoad({filter}, args => {
      return {contents: 'export default null'}
    })
  }
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

function configType(location: string) {
  const file = location.endsWith('.tsx') ? location.slice(0, -4) : location
  return `export * from ${JSON.stringify(file)}`
}

function schemaCollections(workspace: string, schema: Schema) {
  const types = schema.types
  const typeNames = Object.keys(types)
  return `
    import {config} from '../config.js'
    export const schema = config.workspaces['${workspace}'].schema
    export const Page = schema.entry
    ${typeNames
      .map(
        type =>
          `export const ${type} = schema.collection('${workspace}', '${type}')`
      )
      .join('\n')}
  `
    .replace(/  /g, '')
    .trim()
}

function schemaTypes(workspace: string, schema: Schema) {
  const types = schema.types
  const typeNames = Object.keys(types)
  return `
    import {config} from '../config.js'
    import {DataOf, EntryOf} from '@alinea/core'
    import {Collection} from '@alinea/store'
    export const schema = config.workspaces['${workspace}'].schema
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

export type GenerateOptions = {
  cwd?: string
  configFile?: string
  watch?: boolean
  wasmCache?: boolean
}

export async function generate(options: GenerateOptions) {
  const {
    wasmCache = false,
    cwd = process.cwd(),
    configFile = 'alinea.config'
  } = options
  const configLocation = path.join(cwd, configFile)
  const outDir = path.join(cwd, '.alinea')
  async function copy(...files: Array<string>) {
    await Promise.all(
      files.map(file =>
        fs.copyFile(
          path.join(__dirname, 'static', file),
          path.join(outDir, file)
        )
      )
    )
  }
  await failOnBuildError(
    build({
      format: 'esm',
      target: 'esnext',
      treeShaking: true,
      outdir: outDir,
      entryPoints: {config: configLocation},
      bundle: true,
      platform: 'node',
      plugins: [EvalPlugin, externalPlugin, ignorePlugin, ReactPlugin]
    })
  )
  await copy(
    'package.json',
    'index.js',
    'index.d.ts',
    'client.js',
    'client.d.ts',
    'store.d.ts'
  )
  await fs.writeFile(
    path.join(outDir, 'config.d.ts'),
    configType(
      path
        .relative(path.join(cwd, outDir), path.join(cwd, configLocation))
        .split(path.sep)
        .join('/')
    )
  )
  await fs.writeFile(path.join(outDir, '.gitignore'), `*`)
  const genConfigFile = path.join(outDir, 'config.js')
  const outFile = 'file://' + genConfigFile
  const exports = await import(outFile)
  const config: Config = exports.default || exports.config
  if (!config) throw fail(`No config found in "${genConfigFile}"`)
  const store = new SqliteStore(
    new BetterSqlite3Driver(new Database(':memory:')),
    createId
  )
  const sources = Object.values(config.workspaces).map(workspace => {
    return workspace.source
  })
  const customSources: Array<Data.Source> = []
  for (const sourceLocation of sources) {
    const [stats, err] = await outcome(fs.stat(path.join(cwd, sourceLocation)))
    if (err || !stats!.isDirectory()) {
      // Attempt to build and extract source
      const tmpFile = path.join(outDir, '_tmp', createId() + '.js')
      await failOnBuildError(
        build({
          format: 'esm',
          target: 'esnext',
          treeShaking: true,
          outfile: tmpFile,
          entryPoints: [sourceLocation],
          absWorkingDir: outDir,
          bundle: true,
          platform: 'node',
          plugins: [externalPlugin, ignorePlugin, ReactPlugin]
        })
      )
      const outFile = 'file://' + tmpFile
      const exports = await import(outFile).finally(() => fs.unlink(tmpFile))
      customSources.push(exports.default || exports.source)
    }
  }
  const source = Data.Source.concat(
    new FileData({
      config,
      fs: fs.promises,
      loader: JsonLoader,
      rootDir: cwd
    }),
    ...customSources
  )
  await Cache.create(store, config, source, true)
  await fs.writeFile(
    path.join(outDir, 'package.json'),
    JSON.stringify(
      {
        type: 'module',
        sideEffects: false,
        exports: {
          '.': {
            browser: './client.js',
            default: './index.js'
          },
          ...Object.fromEntries(
            Object.keys(config.workspaces).map(key => [
              `./${key}`,
              `./${key}/index.js`
            ])
          )
        }
      },
      null,
      '  '
    )
  )
  for (const [key, workspace] of Object.entries(config.workspaces)) {
    await fs.mkdir(path.join(outDir, key), {recursive: true})
    await fs.writeFile(
      path.join(outDir, key, 'schema.js'),
      schemaCollections(key, workspace.schema)
    )
    await fs.writeFile(
      path.join(outDir, key, 'schema.d.ts'),
      schemaTypes(key, workspace.schema)
    )
    await fs.copy(
      path.join(__dirname, 'static/workspace'),
      path.join(outDir, key),
      {overwrite: true}
    )
    const workspaceIndex = await fs.readFile(
      path.join(__dirname, 'static/workspace/index.js'),
      'utf-8'
    )
    await fs.writeFile(
      path.join(outDir, key, 'index.js'),
      workspaceIndex.replace('$WORKSPACE', key)
    )
  }
  const data = store.export()
  if (!wasmCache) {
    const source = await fs.readFile(
      path.join(__dirname, 'static', 'store.embed.js'),
      'utf-8'
    )
    await fs.writeFile(path.join(outDir, 'store.js'), embedInJs(source, data))
  } else {
    await fs.copyFile(
      path.join(__dirname, 'static', 'store.wasm.js'),
      path.join(outDir, 'store.js')
    )
    await fs.writeFile(path.join(outDir, 'store.wasm'), embedInWasm(data))
  }
  if (false) await fs.writeFile(path.join(outDir, 'store.db'), data)
}
