import {spawn} from 'node:child_process'
import fs from 'node:fs'
import {builtinModules} from 'node:module'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {ReporterPlugin} from '@esbx/reporter'
import {getManifest} from '@esbx/workspaces'
import {dequal} from 'dequal'
import esbuild, {
  type BuildContext,
  type BuildOptions,
  type Plugin
} from 'esbuild'
import fsExtra from 'fs-extra'
import glob from 'glob'
import postcss from 'postcss'
import postcssModules from 'postcss-modules'
import pxtorem from 'postcss-pxtorem'
import prettyBytes from 'pretty-bytes'
import sade from 'sade'
import * as sass from 'sass-embedded'
import {sync} from 'symlink-dir'

sync('.', 'node_modules/alinea')

const BROWSER_TARGET = 'browser'
const SERVER_TARGET = 'server'
const CSS_ENTRY = 'css-entry'
const JS_ENTRY = 'js-entry'

const isWindows = process.platform === 'win32'
const prefix = 'alinea/'

const sassCompiler = await sass.initAsyncCompiler()

const external = builtinModules
  .concat(builtinModules.map(m => `node:${m}`))
  .concat([
    'fs-extra',
    '@alinea/generated',
    '@alinea/iso',
    '@alinea/sqlite-wasm',
    'next',
    'sharp',
    'react',
    'react-dom',
    'esbuild'
  ])

const scssOptions: sass.Options<'async'> = {
  loadPaths: ['./node_modules'],
  quietDeps: true,
  silenceDeprecations: ['import'],
  importers: [
    {
      findFileUrl(url) {
        if (!url.startsWith(prefix)) return null
        return pathToFileURL('src/' + url.slice(prefix.length)) as URL
      }
    }
  ]
}

function hash(files: Array<string>) {
  return files.map(file => fs.statSync(file).mtimeMs).join('-')
}

function dirsOf(source: string) {
  const contents = fs.readdirSync(source, {withFileTypes: true})
  return contents
    .filter(dirent => dirent.isDirectory())
    .flatMap((dirent): Array<string> => {
      const wd = path.join(source, dirent.name)
      return [wd, ...dirsOf(wd)]
    })
}

const cjsModules: Plugin = {
  name: 'cjs-modules',
  setup(build) {
    build.onEnd(async () => {
      await esbuild.build({
        format: 'cjs',
        entryPoints: ['./src/adapter/next/with-alinea.ts'],
        outfile: './dist/next.cjs'
      })
    })
  }
}

const bundleTs: Plugin = {
  name: 'bundle-ts',
  setup(build) {
    build.onEnd(() => {
      const root = './dist'
      const entries = glob.sync('**/*.d.ts', {cwd: root})
      let declaration = ''
      for (const entry of entries) {
        if (entry.includes('/static/')) continue
        const location = entry.slice(0, -'.d.ts'.length)
        const absolute = location === 'index' ? 'alinea' : `alinea/${location}`
        let contents = fs.readFileSync(path.join(root, entry), 'utf-8')
        // Strip shebang
        if (contents.startsWith('#!')) {
          contents = contents.slice(contents.indexOf('\n') + 1)
        }
        contents = contents.replace(
          /(from|import) '(\.\.?\/.*?)'/g,
          (match, p1, p2) => {
            const relative = path
              .join('alinea', path.dirname(location), p2)
              .replaceAll('\\', '/')
              .replace(/\.js$/, '')
            return `${p1} '${relative}'`
          }
        )
        contents = contents.replace(
          /import\("(\.\.?\/.*?)"\)/g,
          (match, p1) => {
            const relative = path
              .join('alinea', path.dirname(location), p1)
              .replaceAll('\\', '/')
              .replace(/\.js$/, '')
            return `import("${relative}")`
          }
        )
        contents = contents.replace(
          /'#view\/(.*?)\.view\.js'/g,
          (match, p1) => {
            return `'alinea/${p1}'`
          }
        )
        // Remove declare keyword
        contents = contents.replace(/declare /g, '')
        declaration += `declare module '${absolute}' {\n\n  ${contents.replace(
          /\n/g,
          '\n  '
        )}\n}\n\n`
      }
      fs.writeFileSync(
        './apps/web/src/page/playground/alinea.d.ts.txt',
        declaration
      )
    })
  }
}

const checkCycles = process.env.CHECK_CYCLES

const internalPlugin: Plugin = {
  name: 'internal',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
    build.onResolve({filter: /^alinea.*/}, args => {
      if (checkCycles) {
        // Make this a relative path
        const file =
          args.path === 'alinea' ? 'index' : args.path.slice('alinea/'.length)
        const localFile = path.join(src, file)
        const target =
          checkCycles === 'browser' ? BROWSER_TARGET : SERVER_TARGET
        const targetFile = `${localFile}.${target}`
        const hasTargetFile =
          fs.existsSync(`${targetFile}.tsx`) ||
          fs.existsSync(`${targetFile}.ts`)
        const relative = hasTargetFile
          ? `./${path.relative(args.resolveDir, targetFile)}.js`
          : `./${path.relative(args.resolveDir, localFile)}.js`
        return {path: relative, external: true}
      }
      return {path: args.path, external: true}
    })
  }
}

const sassJsPlugin: Plugin = {
  name: 'js-sass',
  setup(build) {
    build.onLoad({filter: /\.scss$/}, async args => {
      const {isModule, json, watchFiles} = await processScss(args.path)
      if (!isModule) return {contents: '', loader: 'js', watchFiles}
      return {contents: json, loader: 'js', watchFiles}
    })
  }
}

const sassCssPlugin: Plugin = {
  name: 'css-sass',
  setup(build) {
    build.onLoad({filter: /\.scss$/}, async args => {
      const {css, watchFiles} = await processScss(args.path)
      return {contents: css, loader: 'css', watchFiles}
    })
  }
}

const cleanup: Plugin = {
  name: 'cleanup',
  setup(build) {
    build.initialOptions.metafile = true
    let prevOutputs: Set<string>
    build.onEnd(result => {
      if (!result.metafile) return
      const outputs = new Set(Object.keys(result.metafile.outputs))
      if (prevOutputs) {
        for (const file of prevOutputs)
          if (!outputs.has(file)) fsExtra.removeSync(file)
      }
      prevOutputs = outputs
    })
  }
}

const cssEntry: Plugin = {
  name: CSS_ENTRY,
  setup(build) {
    build.onResolve({filter: new RegExp(`^${CSS_ENTRY}$`)}, args => ({
      path: args.path,
      namespace: CSS_ENTRY
    }))
    build.onLoad(
      {filter: new RegExp(`^${CSS_ENTRY}$`), namespace: CSS_ENTRY},
      args => {
        const files = glob.sync('src/**/*.scss')
        const entryPoint = [`@import url('./src/global.css');`]
          .concat(files.map(file => `@import url('./${file}');`))
          .join('\n')
        return {
          contents: entryPoint,
          loader: 'css',
          watchFiles: files,
          watchDirs: dirsOf('src'),
          resolveDir: '.'
        }
      }
    )
  }
}

const externalize: Plugin = {
  name: 'externalize',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
    build.onResolve({filter: /^\./}, args => {
      if (args.kind === 'entry-point') return
      if (args.path.endsWith('.scss') || args.path.endsWith('.json')) return
      if (!args.resolveDir.startsWith(src)) return
      if (args.path.endsWith('.cjs')) return
      if (!args.path.endsWith('.js') && !args.path.endsWith('.mjs')) {
        console.error(`Missing file extension on local import: ${args.path}`)
        console.error(`In file: ${args.importer}`)
        process.exit(1)
      }
      return {path: args.path, external: true}
    })
  }
}

const targetPlugin: Plugin = {
  name: 'target',
  setup(build) {
    const browserFiles = new Set()
    const serverFiles = new Set()
    build.onStart(() => {
      for (const file of glob.sync(`src/**/*.${BROWSER_TARGET}.tsx`))
        browserFiles.add(
          file.slice('src/'.length, -`.${BROWSER_TARGET}.tsx`.length)
        )
      for (const file of glob.sync(`src/**/*.${BROWSER_TARGET}.ts`))
        browserFiles.add(
          file.slice('src/'.length, -`.${BROWSER_TARGET}.ts`.length)
        )
      for (const file of glob.sync(`src/**/*.${SERVER_TARGET}.tsx`))
        serverFiles.add(
          file.slice('src/'.length, -`.${SERVER_TARGET}.tsx`.length)
        )
      for (const file of glob.sync(`src/**/*.${SERVER_TARGET}.ts`))
        serverFiles.add(
          file.slice('src/'.length, -`.${SERVER_TARGET}.ts`.length)
        )
      const pkg = getManifest('.')
      const exports: Record<string, string | Record<string, string>> = {
        './package.json': './package.json',
        '.': './dist/index.js',
        './css': './dist/index.css',
        './next': {
          'edge-light': './dist/next.edge.js',
          require: './dist/next.cjs',
          default: './dist/next.js'
        },
        './*.cjs': './dist/*.cjs',
        './*': './dist/*.js'
      }
      const bFiles = [...browserFiles].sort()
      for (const file of bFiles) {
        exports[`./${file}`] = {
          'edge-light': `./dist/${file}.js`,
          worker: `./dist/${file}.js`,
          browser: `./dist/${file}.${BROWSER_TARGET}.js`,
          default: `./dist/${file}.js`
        }
      }
      const sFiles = [...serverFiles].sort()
      for (const file of sFiles) {
        exports[`./${file}`] = {
          'edge-light': `./dist/${file}.${SERVER_TARGET}.js`,
          worker: `./dist/${file}.${SERVER_TARGET}.js`,
          browser: `./dist/${file}.js`,
          default: `./dist/${file}.${SERVER_TARGET}.js`
        }
      }
      fs.writeFileSync(
        'package.json',
        JSON.stringify({...pkg, exports}, null, 2) + '\n'
      )
    })
  }
}

function jsEntry({
  watch,
  test,
  report
}: {
  watch: boolean
  test: boolean
  report: boolean
}): Plugin {
  const plugins = [sassJsPlugin, internalPlugin, externalize, cleanup]
  if (report) plugins.push(reportSizePlugin)
  return {
    name: JS_ENTRY,
    setup(build) {
      let context: BuildContext
      let currentFiles: Array<string> = []
      build.onResolve({filter: new RegExp(`^${JS_ENTRY}$`)}, args => ({
        path: args.path,
        namespace: JS_ENTRY
      }))
      build.onLoad(
        {filter: new RegExp(`^${JS_ENTRY}$`), namespace: JS_ENTRY},
        async args => {
          const staticFolders = glob.sync('src/**/static')
          for (const folder of staticFolders) {
            const target = folder.replace('src/', 'dist/')
            fsExtra.copySync(folder, target)
          }
          const files = glob.sync('src/**/*.{ts,tsx}').filter(file => {
            if (file.endsWith('UIStory.tsx')) return false
            if (!test && file.endsWith('.test.ts')) return false
            return !file.endsWith('.d.ts') && !file.endsWith('.stories.tsx')
          })
          if (!context || !dequal(currentFiles, files)) {
            context = await esbuild.context({
              plugins,
              format: 'esm',
              entryPoints: files,
              outdir: 'dist',
              bundle: true,
              splitting: true,
              treeShaking: true,
              external,
              chunkNames: 'chunks/[name]-[hash]',
              platform: 'neutral',
              mainFields: ['module', 'main'],
              jsx: 'automatic',
              alias: {
                yjs: `./src/yjs.ts`,
                // Mistakenly imported because it is used in the JSDocs
                'y-protocols/awareness': `data:text/javascript,
                  export const Awareness = undefined
                `,

                // Used in lib0, polyfill crypto for nodejs
                'lib0/webcrypto': `data:text/javascript,
                  import {crypto} from '@alinea/iso'
                  export const subtle = crypto.subtle
                  export const getRandomValues = crypto.getRandomValues.bind(crypto)`
              },
              define: {
                // See https://github.com/pmndrs/jotai/blob/2188d7557500e59c10415a9e74bb5cfc8a3f9c31/src/react/useSetAtom.ts#L33
                'import.meta.env.MODE': '"production"'
              }
            })
            currentFiles = files
          }
          const result = await context.rebuild().catch(() => {})
          if (!watch) context.dispose()
          return {
            contents: '',
            resolveDir: '.',
            watchDirs: staticFolders,
            watchFiles: result?.metafile
              ? Object.keys(result.metafile.inputs)
              : files
          }
        }
      )
    }
  }
}

const sassExports = new Map()
const sassCache = new Map()

const postCssPlugins = [
  pxtorem({
    minPixelValue: 2,
    propList: ['*']
  }),
  postcssModules({
    localsConvention: 'dashes',
    generateScopedName(name, fileName, css) {
      const module = path.basename(fileName).split('.')[0]
      if (name.startsWith('root-')) name = name.slice(5)
      if (name.startsWith('root')) name = name.slice(4)
      return `alinea-${module}${name ? '-' + name : ''}`
    },
    getJSON(file, json) {
      sassExports.set(file, `export default ${JSON.stringify(json, null, 2)}`)
    }
  })
]

type ProcessScssResult = {
  key: string
  css: string
  watchFiles: string[]
  isModule?: boolean
  json?: string
}

async function processScss(file: string): Promise<ProcessScssResult> {
  const prev = sassCache.get(file)
  if (prev) {
    const key = hash(prev.watchFiles)
    if (key === prev.key) return prev
  }
  const {css, loadedUrls, sourceMap} = await sassCompiler.compileAsync(
    file,
    scssOptions
  )
  const watchFiles = loadedUrls.map(url => {
    return url.pathname.substring(isWindows ? 1 : 0)
  })
  const key = hash(watchFiles)
  if (!file.endsWith('.module.scss')) {
    const result = {key, css, watchFiles}
    sassCache.set(file, result)
    return result
  }
  const processed = await postcss(postCssPlugins).process(css, {
    from: file,
    map: {
      inline: true,
      prev: sourceMap
    }
  })
  const result = {
    key,
    css: processed.css,
    watchFiles,
    isModule: true,
    json: sassExports.get(file)
  }
  sassCache.set(file, result)
  return result
}

function forwardCmd() {
  const argv = process.argv
  const separator = argv.findIndex(arg => arg === '--')
  if (separator === -1) return
  const command = argv.slice(separator + 1)
  if (command.length === 0) return
  return command.join(' ')
}

const runPlugin: Plugin = {
  name: 'run',
  setup(build) {
    let isStarted = false
    build.onEnd(res => {
      if (isStarted) return
      if (res.errors.length > 0) return
      const cmd = forwardCmd()
      if (!cmd) return
      spawn(cmd, {
        stdio: 'inherit',
        shell: true
      })
      isStarted = true
    })
  }
}

const reportSizePlugin: Plugin = {
  name: 'report-size',
  setup(build) {
    build.initialOptions.minify = true
    build.onEnd(async result => {
      if (result.errors.length > 0) return
      const common = {
        format: 'esm',
        write: false,
        bundle: true,
        minify: true,
        metafile: true,
        logOverride: {
          'ignored-bare-import': 'silent'
        },
        external
      } satisfies BuildOptions
      const server = await build.esbuild.build({
        ...common,
        platform: 'node',
        entryPoints: {server: 'dist/index.js'},
        tsconfigRaw: {}
      })
      console.info(
        `Server output: ` +
          prettyBytes(server.metafile.outputs['server.js'].bytes)
      )
      const dashboard = await build.esbuild.build({
        ...common,
        platform: 'browser',
        entryPoints: {dashboard: 'dist/dashboard/App.js'},
        tsconfigRaw: {}
      })
      console.info(
        `Dashboard output: ` +
          prettyBytes(dashboard.metafile.outputs['dashboard.js'].bytes)
      )
    })
  }
}

async function build({
  watch,
  test,
  report
}: {
  watch: boolean
  test: boolean
  report: boolean
}): Promise<void> {
  const plugins = [
    targetPlugin,
    cssEntry,
    sassCssPlugin,
    cleanup,
    jsEntry({watch, test, report}),
    bundleTs,
    ReporterPlugin.configure({name: 'alinea'}),
    runPlugin,
    cjsModules
  ]
  const context = await esbuild.context({
    bundle: true,
    entryPoints: [
      {in: CSS_ENTRY, out: 'index'},
      {in: JS_ENTRY, out: 'dummy'}
    ],
    outdir: 'dist',
    loader: {
      '.woff2': 'file'
    },
    sourcemap: Boolean(watch),
    plugins
  })

  return watch
    ? context.watch()
    : context.rebuild().then(() => context.dispose())
}

sade('build', true)
  .option('--report', `Report build stats`)
  .option('--watch', `Watch for changes`)
  .action(async opts => {
    await build(opts)
    if (!opts.watch) sassCompiler.dispose()
  })
  .parse(process.argv)
