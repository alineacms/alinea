import {Cache, Data, JsonLoader} from '@alinea/backend'
import {FileData} from '@alinea/backend/data/FileData'
import {Config} from '@alinea/core/Config'
import {createId} from '@alinea/core/Id'
import {outcome} from '@alinea/core/Outcome'
import {Workspace} from '@alinea/core/Workspace'
import {BetterSqlite3Driver} from '@alinea/store/sqlite/drivers/BetterSqlite3Driver'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {encode} from 'base64-arraybuffer'
import {FSWatcher} from 'chokidar'
import {dirname} from 'dirname-filename-esm'
import {build, BuildResult, Plugin} from 'esbuild'
import fs from 'fs-extra'
import {signed, unsigned} from 'leb128'
import crypto from 'node:crypto'
import path from 'node:path'
import {ignorePlugin} from './util/IgnorePlugin'

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

type ServerPluginOptions = {
  outDir: string
}

function serverPlugin({outDir}: ServerPluginOptions): Plugin {
  return {
    name: 'server',
    setup(build) {
      // Hook into any import that ends in .query.(js/ts)
      // compile and place the file in the server directory
      build.onResolve({filter: /\.query(\.js|\.ts)?$/}, async args => {
        const location = crypto
          .createHash('md5')
          .update(args.resolveDir)
          .digest('hex')
          .slice(0, 7)
        let filename = location + '.' + path.basename(args.path)
        if (filename.endsWith('.ts')) filename = filename.slice(0, -3) + '.js'
        if (!filename.endsWith('.js')) filename += '.js'
        await build.esbuild.build({
          platform: 'node',
          bundle: true,
          format: 'esm',
          target: 'esnext',
          treeShaking: true,
          entryPoints: [path.join(args.resolveDir, args.path)],
          outfile: path.join(outDir, '.server/dist', filename),
          plugins: [externalPlugin, ignorePlugin]
        })
        return {external: true, path: `@alinea/content/.server/${filename}`}
      })
    }
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

function wrapNamespace(code: string, namespace: string | undefined) {
  if (namespace) return `export namespace ${namespace} {\n${code}\n}`
  return code
}

function schemaCollections(workspace: Workspace) {
  const typeNames = workspace.schema.keys
  const collections = workspace.typeNamespace
    ? `export const ${workspace.typeNamespace} = {
      AnyPage: schema.collection(),
      ${typeNames
        .map(type => `${type}: schema.type('${type}').collection()`)
        .join(',\n')}
    }`
    : `
    export const AnyPage = schema.collection()
    ${typeNames
      .map(type => `export const ${type} = schema.type('${type}').collection()`)
      .join('\n')}
  `
  return `
    import {config} from '../config.js'
    export const workspace = config.workspaces['${workspace.name}']
    export const schema = workspace.schema
    ${collections}
  `
    .replace(/  /g, '')
    .trim()
}

function schemaTypes(workspace: Workspace) {
  const typeNames = workspace.schema.keys
  const collections = `export type AnyPage = EntryOf<Entry & typeof schema>
  export const AnyPage: Collection<AnyPage>
  export type Pages = AlineaPages<AnyPage>
  ${typeNames
    .map(
      type =>
        `export const ${type}: Collection<Extract<AnyPage, {type: '${type}'}>>
        export type ${type} = DataOf<typeof ${type}>`
    )
    .join('\n')}`
  return `
    import {config} from '../config.js'
    import {DataOf, EntryOf, Entry} from '@alinea/core'
    import {Collection} from '@alinea/store'
    import type {Pages as AlineaPages} from '@alinea/backend'
    export const schema = config.workspaces['${workspace.name}'].schema
    ${wrapNamespace(collections, workspace.typeNamespace)}
  `
    .replace(/  /g, '')
    .trim()
}

export type GenerateOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  watch?: boolean
  onConfigRebuild?: (err?: Error) => void
  onCacheRebuild?: (err?: Error) => void
  wasmCache?: boolean
  quiet?: boolean
}

export async function generate(options: GenerateOptions) {
  const {
    wasmCache = false,
    cwd = process.cwd(),
    configFile = 'alinea.config',
    staticDir = path.join(__dirname, 'static'),
    quiet = false,
    onConfigRebuild,
    onCacheRebuild
  } = options
  let cacheWatcher: Promise<{stop: () => void}> | undefined
  const configLocation = path.join(cwd, configFile)
  const outDir = path.join(cwd, '.alinea')
  const watch = options.watch || onConfigRebuild || onCacheRebuild

  await fs.copy(path.join(staticDir, 'server'), path.join(outDir, '.server'), {
    overwrite: true
  })

  await compileConfig()
  await copyStaticFiles()
  await generatePackage()

  async function copyStaticFiles() {
    await fs.mkdirp(outDir).catch(console.log)
    async function copy(...files: Array<string>) {
      await Promise.all(
        files.map(file =>
          fs.copyFile(path.join(staticDir, file), path.join(outDir, file))
        )
      )
    }
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
      configType(path.resolve(configLocation))
    )
    await fs.writeFile(path.join(outDir, '.gitignore'), `*\n!.keep`)
    await fs.writeFile(
      path.join(outDir, '.keep'),
      '# Contents of this folder are autogenerated by alinea'
    )
  }

  async function compileConfig() {
    return failOnBuildError(
      build({
        format: 'esm',
        target: 'esnext',
        treeShaking: true,
        outdir: outDir,
        entryPoints: {config: configLocation},
        bundle: true,
        platform: 'node',
        plugins: [
          serverPlugin({outDir}),
          EvalPlugin,
          externalPlugin,
          ignorePlugin,
          ReactPlugin
        ],
        watch: watch && {
          async onRebuild(error, result) {
            if (!error) await generatePackage()
            if (onConfigRebuild) return onConfigRebuild(error || undefined)
          }
        }
      })
    )
  }

  async function generatePackage() {
    if (cacheWatcher) (await cacheWatcher).stop()
    const config = await loadConfig()
    return Promise.all([
      generateWorkspaces(config),
      (cacheWatcher = fillCache(config))
    ])
  }

  async function loadConfig() {
    const genConfigFile = path.join(outDir, 'config.js')
    const outFile = 'file://' + genConfigFile
    const exports = await import(outFile)
    const config: Config = exports.default || exports.config
    if (!config) throw fail(`No config found in "${genConfigFile}"`)
    return config
  }

  async function generateWorkspaces(config: Config) {
    for (const [key, workspace] of Object.entries(config.workspaces)) {
      await fs.mkdir(path.join(outDir, key), {recursive: true})
      await fs.writeFile(
        path.join(outDir, key, 'schema.js'),
        schemaCollections(workspace)
      )
      await fs.writeFile(
        path.join(outDir, key, 'schema.d.ts'),
        schemaTypes(workspace)
      )
      await fs.copy(path.join(staticDir, 'workspace'), path.join(outDir, key), {
        overwrite: true
      })
    }
    const pkg = JSON.parse(
      await fs.readFile(path.join(staticDir, 'package.json'), 'utf8')
    )
    await fs.writeFile(
      path.join(outDir, 'package.json'),
      JSON.stringify(
        {
          ...pkg,
          exports: {
            ...pkg.exports,
            ...Object.fromEntries(
              Object.keys(config.workspaces).flatMap(key => [
                [
                  `./${key}`,
                  {
                    browser: `./${key}/schema.js`,
                    default: `./${key}/index.js`
                  }
                ],
                [`./${key}/*`, `./${key}/*`]
              ])
            )
          }
        },
        null,
        '  '
      )
    )
  }

  async function fillCache(config: Config) {
    let watcher: FSWatcher | undefined
    let caching: Promise<void> | undefined
    const source = await createSource(config)
    const files = await source.watchFiles?.()
    async function cache() {
      const store = await cacheEntries(config, source)
      await createCache(store)
    }
    if (watch && files) {
      watcher = new FSWatcher()
      async function reload() {
        if (caching) await caching
        caching = cache().then(
          () => onCacheRebuild?.(),
          err => onCacheRebuild?.(err)
        )
      }
      watcher.add(files).on('change', reload)
      watcher.add(files).on('unlink', reload)
    }
    caching = cache()
    await caching
    return {stop: () => watcher?.close()}
  }

  async function createSource(config: Config) {
    const sources = Object.values(config.workspaces).map(workspace => {
      return workspace.source
    })
    const customSources: Array<Data.Source> = []
    for (const sourceLocation of sources) {
      const [stats, err] = await outcome(
        fs.stat(path.join(cwd, sourceLocation))
      )
      if (err || !stats!.isDirectory()) {
        // Attempt to build and extract source
        const tmpFile = path.join(outDir, '_tmp', createId() + '.js')
        await failOnBuildError(
          build({
            platform: 'node',
            bundle: true,
            format: 'esm',
            target: 'esnext',
            treeShaking: true,
            outfile: tmpFile,
            entryPoints: [sourceLocation],
            absWorkingDir: outDir,
            plugins: [externalPlugin, ignorePlugin, ReactPlugin]
          })
        )
        const outFile = 'file://' + tmpFile
        const exports = await import(outFile).finally(() => fs.unlink(tmpFile))
        customSources.push(exports.default || exports.source)
      }
    }
    return Data.Source.concat(
      new FileData({
        config,
        fs: fs.promises,
        loader: JsonLoader,
        rootDir: cwd
      }),
      ...customSources
    )
  }

  async function cacheEntries(config: Config, source: Data.Source) {
    let store: SqliteStore
    try {
      const {default: Database} = await import('better-sqlite3')
      store = new SqliteStore(
        new BetterSqlite3Driver(new Database(':memory:')),
        createId
      )
    } catch (e) {
      const {default: sqlInit} = await import('@alinea/sqlite-wasm')
      const {Database} = await sqlInit()
      store = new SqliteStore(new SqlJsDriver(new Database()), createId)
    }
    await Cache.create(store, config, source, !quiet)
    return store
  }

  async function createCache(store: SqliteStore) {
    const data = store.export()
    if (!wasmCache) {
      const source = await fs.readFile(
        path.join(staticDir, 'store.embed.js'),
        'utf-8'
      )
      await fs.writeFile(path.join(outDir, 'store.js'), embedInJs(source, data))
    } else {
      await fs.copyFile(
        path.join(staticDir, 'store.wasm.js'),
        path.join(outDir, 'store.js')
      )
      await fs.writeFile(path.join(outDir, 'store.wasm'), embedInWasm(data))
    }
    if (true) await fs.writeFile(path.join(outDir, 'store.db'), data)
  }
}
