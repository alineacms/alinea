import {Cache, Data, JsonLoader} from '@alinea/backend'
import {FileData} from '@alinea/backend/data/FileData'
import {createDb} from '@alinea/backend/util/CreateDb'
import {Config} from '@alinea/core/Config'
import {createError} from '@alinea/core/ErrorWithCode'
import {createId} from '@alinea/core/Id'
import {Outcome, outcome} from '@alinea/core/Outcome'
import {Logger} from '@alinea/core/util/Logger'
import {Workspace} from '@alinea/core/Workspace'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {EvalPlugin} from '@esbx/eval'
import {FSWatcher} from 'chokidar'
import semver from 'compare-versions'
import {build, BuildResult} from 'esbuild'
import fs from 'fs-extra'
import {createRequire} from 'node:module'
import path from 'node:path'
import {buildOptions} from './build/BuildOptions'
import {exportStore} from './ExportStore'
import {dirname} from './util/Dirname'
import {externalPlugin} from './util/ExternalPlugin'
import {ignorePlugin} from './util/IgnorePlugin'
import {targetPlugin} from './util/TargetPlugin'

const __dirname = dirname(import.meta.url)
const require = createRequire(import.meta.url)

async function copyFileIfContentsDiffer(source: string, target: string) {
  const data = await fs.readFile(source)
  try {
    const current = await fs.readFile(target)
    if (current.equals(data)) return
  } catch (e) {}
  return fs.copyFile(source, target)
}

async function writeFileIfContentsDiffer(
  destination: string,
  contents: string | Buffer
) {
  const data = Buffer.from(contents)
  try {
    const current = await fs.readFile(destination)
    if (current.equals(data)) return
  } catch (e) {}
  return fs.writeFile(destination, data)
}

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

function code(strings: ReadonlyArray<string>, ...inserts: Array<any>) {
  const res: Array<string> = []
  strings.forEach(function (str, i) {
    res.push(str)
    if (i in inserts) res.push(String(inserts[i]))
  })
  return res.join('').replace(/  /g, '').trim()
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
  return code`
    import {config} from '../config.js'
    export const workspace = config.workspaces['${workspace.name}']
    export const schema = workspace.schema
    ${collections}
  `
}

function pagesType(workspace: Workspace) {
  return code`
    import {${workspace.typeNamespace || 'Pages'}} from './schema.js'
    export const initPages: (previewToken?: string) => ${
      workspace.typeNamespace ? `${workspace.typeNamespace}.` : ''
    }Pages
  `
}

function pagesOf(workspace: Workspace) {
  return code`
    import {backend} from '../backend.js'
    export function initPages(previewToken) {
      return backend.loadPages('${workspace.name}', {
        previewToken
      })
    }
  `
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
  return code`
    import {config} from '../config.js'
    import {DataOf, EntryOf, Entry} from '@alinea/core'
    import {Collection} from '@alinea/store'
    import type {Pages as AlineaPages} from '@alinea/backend'
    export const schema: (typeof config)['workspaces']['${
      workspace.name
    }']['schema']
    ${wrapNamespace(collections, workspace.typeNamespace)}
  `
}

export type GenerateOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  watch?: boolean
  onConfigRebuild?: (outcome: Outcome<Config>) => void
  onCacheRebuild?: (outcome: Outcome<SqliteStore>) => void
  wasmCache?: boolean
  quiet?: boolean
  store?: SqliteStore
  onAfterGenerate?: () => void
}

export async function generate(options: GenerateOptions): Promise<Config> {
  const {
    wasmCache = false,
    cwd = process.cwd(),
    configFile = 'alinea.config',
    staticDir = path.join(__dirname, 'static'),
    quiet = false,
    onConfigRebuild,
    onCacheRebuild
  } = options
  const store = options.store || (await createDb())
  let cacheWatcher: Promise<{stop: () => void}> | undefined
  let generating: Promise<void> | undefined
  const configLocation = path.join(cwd, configFile)
  const outDir = path.join(cwd, '.alinea')
  const watch = options.watch || onConfigRebuild || onCacheRebuild

  await copyBoilerplate()
  await compileConfig()
  await copyStaticFiles()
  let {config, reloadConfig} = await loadConfig()
  await (generating = generatePackage())
  if (options.onAfterGenerate) options.onAfterGenerate()
  return config

  async function copyBoilerplate() {
    await fs.copy(
      path.join(staticDir, 'server'),
      path.join(outDir, '.server'),
      {
        overwrite: true
      }
    )
  }

  async function copyStaticFiles() {
    await fs.mkdirp(outDir).catch(console.log)
    function copy(...files: Array<string>) {
      return Promise.all(
        files.map(file =>
          fs.copyFile(path.join(staticDir, file), path.join(outDir, file))
        )
      )
    }
    await copy(
      'package.json',
      'index.js',
      'index.d.ts',
      'drafts.js',
      'backend.js',
      'backend.d.ts',
      'store.d.ts'
    )

    await writeFileIfContentsDiffer(
      path.join(outDir, 'config.d.ts'),
      configType(path.resolve(configLocation))
    )
    await writeFileIfContentsDiffer(
      path.join(outDir, '.gitignore'),
      `*\n!.keep`
    )
    await writeFileIfContentsDiffer(
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
        jsx: 'automatic',
        plugins: [
          targetPlugin(file => {
            return {
              packageName: '@alinea/content',
              packageRoot: outDir
            }
          }),
          EvalPlugin,
          externalPlugin,
          ignorePlugin
        ],
        watch: watch && {
          async onRebuild(error, result) {
            await reloadConfig()
            if (!error) {
              if (generating) await generating
              await (generating = generatePackage())
            }
            if (onConfigRebuild)
              return onConfigRebuild(
                error ? Outcome.Failure(error) : Outcome.Success(config)
              )
          }
        },
        tsconfig: path.join(staticDir, 'tsconfig.json')
      })
    )
  }

  async function loadConfig() {
    const unique = Date.now()
    const genConfigFile = path.join(outDir, 'config.js')
    const outFile = `file://${genConfigFile}?${unique}`
    const exports = await import(outFile)
    const newConfig: Config = exports.config
    if (!newConfig) throw fail(`No config found in "${genConfigFile}"`)
    return {
      config: newConfig,
      reloadConfig: async () => {
        // An attempt at having the previous config garbage collected,
        // no clue if this will work.
        // See: nodejs/tooling#51
        // exports.config = null
        const reloaded = await loadConfig()
        config = reloaded.config
        reloadConfig = reloaded.reloadConfig
      }
    }
  }

  async function generatePackage() {
    if (cacheWatcher) (await cacheWatcher).stop()
    await Promise.all([
      generateWorkspaces(config),
      (cacheWatcher = fillCache(config))
    ])
    const dashboard = config.dashboard
    if (dashboard?.staticFile)
      await generateDashboard(dashboard.handlerUrl, dashboard.staticFile!)
  }

  async function generateWorkspaces(config: Config) {
    for (const [key, workspace] of Object.entries(config.workspaces)) {
      function copy(...files: Array<string>) {
        return Promise.all(
          files.map(file =>
            copyFileIfContentsDiffer(
              path.join(staticDir, 'workspace', file),
              path.join(outDir, key, file)
            )
          )
        )
      }
      await Promise.all([
        fs.mkdir(path.join(outDir, key), {recursive: true}),
        writeFileIfContentsDiffer(
          path.join(outDir, key, 'schema.js'),
          schemaCollections(workspace)
        ),
        writeFileIfContentsDiffer(
          path.join(outDir, key, 'schema.d.ts'),
          schemaTypes(workspace)
        ),
        copy('index.d.ts', 'index.js'),
        writeFileIfContentsDiffer(
          path.join(outDir, key, 'pages.js'),
          pagesOf(workspace)
        ),
        writeFileIfContentsDiffer(
          path.join(outDir, key, 'pages.d.ts'),
          pagesType(workspace)
        )
      ])
    }
    const pkg = JSON.parse(
      await fs.readFile(path.join(staticDir, 'package.json'), 'utf8')
    )
    await writeFileIfContentsDiffer(
      path.join(outDir, 'package.json'),
      JSON.stringify(
        {
          ...pkg,
          exports: {
            ...pkg.exports,
            ...Object.fromEntries(
              Object.keys(config.workspaces).flatMap(key => [
                [`./${key}`, `./${key}/index.js`],
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
      return store
    }
    if (watch && files) {
      watcher = new FSWatcher()
      async function reload() {
        if (caching) await caching
        caching = cache().then(
          store => onCacheRebuild?.(Outcome.Success(store)),
          err => onCacheRebuild?.(Outcome.Failure(err))
        )
      }
      watcher.add(files).on('change', reload)
      watcher.add(files).on('unlink', reload)
    }
    caching = cache().then(() => void 0)
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
            jsx: 'automatic',
            plugins: [externalPlugin, ignorePlugin]
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
    const db = await createDb(store)
    await Cache.create(
      db,
      config,
      source,
      quiet ? undefined : new Logger('Generate')
    )
    return db
  }

  function createCache(store: SqliteStore) {
    return exportStore(store, path.join(outDir, 'store.js'), wasmCache)
  }

  async function generateDashboard(handlerUrl: string, staticFile: string) {
    if (!staticFile.endsWith('.html'))
      throw createError(
        `The staticFile option in config.dashboard must point to an .html file (include the extension)`
      )
    const {version} = require('react/package.json')
    const isReact18 = semver.compare(version, '18.0.0', '>=')
    const react = isReact18 ? 'react18' : 'react'
    const entryPoints = {
      entry: '@alinea/dashboard/EntryPoint',
      config: '@alinea/content/config.js'
    }
    const basename = path.basename(staticFile, '.html')
    const assetsFolder = path.join(path.dirname(staticFile), basename)
    await build({
      format: 'esm',
      target: 'esnext',
      treeShaking: true,
      minify: true,
      splitting: true,
      outdir: assetsFolder,
      bundle: true,
      absWorkingDir: cwd,
      entryPoints,
      inject: [path.join(staticDir, `render/render-${react}.js`)],
      platform: 'browser',
      define: {
        'process.env.NODE_ENV': "'production'"
      },
      ...buildOptions,
      tsconfig: path.join(staticDir, 'tsconfig.json'),
      logLevel: 'error'
    }).catch(e => {
      throw 'Could not compile entrypoint'
    })
    await writeFileIfContentsDiffer(
      path.join(cwd, staticFile),
      code`
        <!DOCTYPE html>
        <meta charset="utf-8" />
        <link rel="icon" href="data:," />
        <link href="./${basename}/entry.css" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="handshake_url" value="${handlerUrl}/hub/auth/handshake" />
        <meta name="redirect_url" value="${handlerUrl}/hub/auth" />
        <body>
          <script type="module">
            import {boot} from './${basename}/entry.js'
            boot('${handlerUrl}')
          </script>
        </body>
      `
    )
  }
}
