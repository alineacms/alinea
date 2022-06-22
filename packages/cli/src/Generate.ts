import {Cache, Data, JsonLoader} from '@alinea/backend'
import {FileData} from '@alinea/backend/data/FileData'
import {Config} from '@alinea/core/Config'
import {createError} from '@alinea/core/ErrorWithCode'
import {createId} from '@alinea/core/Id'
import {outcome} from '@alinea/core/Outcome'
import {Workspace} from '@alinea/core/Workspace'
import {SqlJsDriver} from '@alinea/store/sqlite/drivers/SqlJsDriver'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {FSWatcher} from 'chokidar'
import semver from 'compare-versions'
import {build, BuildResult} from 'esbuild'
import fs from 'fs-extra'
import {createRequire} from 'node:module'
import path from 'node:path'
import {buildOptions} from './build/BuildOptions'
import {exportStore} from './export/ExportStore'
import {dirname} from './util/Dirname'
import {externalPlugin} from './util/ExternalPlugin'
import {ignorePlugin} from './util/IgnorePlugin'
import {targetPlugin} from './util/TargetPlugin'

const __dirname = dirname(import.meta)
const require = createRequire(import.meta.url)

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

function pagesOf(workspace: Workspace) {
  return code`
    import {backend} from '../backend.js'
    export const pages = backend.loadPages('${workspace.name}', {
      preview: process.env.NODE_ENV === 'development'
    })
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
    export const schema = config.workspaces['${workspace.name}'].schema
    ${wrapNamespace(collections, workspace.typeNamespace)}
  `
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
      'client.js',
      'client.d.ts',
      'backend.js',
      'backend.d.ts',
      'store.d.ts'
    )
    await outcome(
      fs.copyFile(
        path.join(staticDir, 'drafts.js'),
        path.join(outDir, 'drafts.js'),
        fs.constants.COPYFILE_EXCL
      )
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
          targetPlugin(file => {
            return {
              packageName: '@alinea/content',
              packageRoot: outDir
            }
          }),
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
    await Promise.all([
      generateWorkspaces(config),
      (cacheWatcher = fillCache(config))
    ])
    if (config.dashboard) await generateDashboard(config.dashboard)
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
      function copy(...files: Array<string>) {
        return Promise.all(
          files.map(file =>
            fs.copyFile(
              path.join(staticDir, 'workspace', file),
              path.join(outDir, key, file)
            )
          )
        )
      }
      await Promise.all([
        fs.mkdir(path.join(outDir, key), {recursive: true}),
        fs.writeFile(
          path.join(outDir, key, 'schema.js'),
          schemaCollections(workspace)
        ),
        fs.writeFile(
          path.join(outDir, key, 'schema.d.ts'),
          schemaTypes(workspace)
        ),
        copy('index.d.ts', 'index.js', 'pages.d.ts'),
        fs.writeFile(path.join(outDir, key, 'pages.js'), pagesOf(workspace))
      ])
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
    const {default: sqlInit} = await import('@alinea/sqlite-wasm')
    const {Database} = await sqlInit()
    store = new SqliteStore(new SqlJsDriver(new Database()), createId)
    await Cache.create(store, config, source, !quiet)
    return store
  }

  function createCache(store: SqliteStore) {
    return exportStore(store, path.join(outDir, 'store.js'), wasmCache)
  }

  type GenerateDashboardOptions = {handlerUrl: string; staticFile: string}

  async function generateDashboard(options: GenerateDashboardOptions) {
    const {staticFile, handlerUrl} = options
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
      // Todo: this is only needed during dev
      tsconfig: path.join(staticDir, 'tsconfig.json'),
      logLevel: 'error'
    }).catch(e => {
      throw 'Could not compile entrypoint'
    })
    await fs.writeFile(
      path.join(cwd, staticFile),
      code`
        <!DOCTYPE html>
        <meta charset="utf-8" />
        <link rel="icon" href="data:," />
        <link href="${basename}/entry.css" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="handshake_url" value="${handlerUrl}/hub/auth/handshake" />
        <meta name="redirect_url" value="${handlerUrl}/hub/auth" />
        <body>
          <script type="module">
            import {boot} from '${basename}/entry.js'
            boot('${handlerUrl}')
          </script>
        </body>
      `
    )
  }
}
