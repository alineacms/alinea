import {ReporterPlugin} from '@esbx/reporter'
import {getManifest} from '@esbx/workspaces'
import {spawn} from 'child_process'
import {dequal} from 'dequal'
import esbuild from 'esbuild'
import fsExtra from 'fs-extra'
import glob from 'glob'
import {builtinModules} from 'module'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import postcss from 'postcss'
import postcssModules from 'postcss-modules'

// Interestingly sass seems to outperform sass-embedded about 2x
import * as sass from 'sass'

const BROWSER_TARGET = 'browser'
const SERVER_TARGET = 'server'
const CSS_ENTRY = 'css-entry'
const JS_ENTRY = 'js-entry'

const isWindows = process.platform === 'win32'
const prefix = 'alinea/'
const resolveAlinea = {
  findFileUrl(url) {
    if (!url.startsWith(prefix)) return null
    return pathToFileURL('src/' + url.slice(prefix.length))
  }
}

const external = builtinModules
  .concat(builtinModules.map(m => `node:${m}`))
  .concat([
    'fs-extra',
    '@alinea/generated',
    '@alinea/iso',
    '@alinea/sqlite-wasm',
    'next',
    'next/navigation',
    '@remix-run/node',
    '@remix-run/react',
    'react/jsx-runtime',
    'react',
    'react-dom',
    'sass',
    'glob',
    'esbuild'
  ])

const scssOptions = {
  loadPaths: ['./node_modules'],
  importers: [resolveAlinea]
}

function hash(files) {
  return files.map(file => fs.statSync(file).mtimeMs).join('-')
}

function dirsOf(source) {
  const contents = fs.readdirSync(source, {withFileTypes: true})
  return contents
    .filter(dirent => dirent.isDirectory())
    .flatMap(dirent => {
      const wd = path.join(source, dirent.name)
      return [wd, ...dirsOf(wd)]
    })
}

/** @type {import('esbuild').Plugin} */
const bundleTs = {
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
      fs.writeFileSync('./apps/web/src/playground/alinea.d.ts.txt', declaration)
    })
  }
}

/** @type {import('esbuild').Plugin} */
const internalPlugin = {
  name: 'internal',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
    build.onResolve({filter: /^alinea\/.*/}, args => {
      return {path: args.path, external: true}
      /*return build.resolve('./' + path.join('src', file), {
        kind: args.kind,
        resolveDir: cwd
      })*/
    })
  }
}

/** @type {import('esbuild').Plugin} */
const sassJsPlugin = {
  name: 'js-sass',
  setup(build) {
    build.onLoad({filter: /\.scss$/}, async args => {
      const {isModule, json, watchFiles} = await processScss(args.path)
      if (!isModule) return {contents: '', loader: 'js', watchFiles}
      return {contents: json, loader: 'js', watchFiles}
    })
  }
}

/** @type {import('esbuild').Plugin} */
const sassCssPlugin = {
  name: 'css-sass',
  setup(build) {
    build.onLoad({filter: /\.scss$/}, async args => {
      const {css, watchFiles} = await processScss(args.path)
      return {contents: css, loader: 'css', watchFiles}
    })
  }
}

/** @type {import('esbuild').Plugin} */
const cleanup = {
  name: 'cleanup',
  setup(build) {
    build.initialOptions.metafile = true
    let prevOutputs
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

/** @type {import('esbuild').Plugin} */
const cssEntry = {
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

/** @type {import('esbuild').Plugin} */
const externalize = {
  name: 'externalize',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
    build.onResolve({filter: /^\./}, args => {
      if (args.kind === 'entry-point') return
      if (args.path.endsWith('.scss') || args.path.endsWith('.json')) return
      if (!args.resolveDir.startsWith(src)) return
      if (!args.path.endsWith('.js')) {
        console.error(`Missing file extension on local import: ${args.path}`)
        console.error(`In file: ${args.importer}`)
        process.exit(1)
      }
      return {path: args.path, external: true}
    })
  }
}

/** @type {import('esbuild').Plugin} */
const targetPlugin = {
  name: 'target',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
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
      const exports = {
        '.': './dist/index.js',
        './css': './dist/index.css',
        './*.cjs': './dist/*.cjs',
        './*': './dist/*.js'
      }
      const bFiles = [...browserFiles].sort()
      for (const file of bFiles) {
        exports[`./${file}`] = {
          worker: `./dist/${file}.js`,
          browser: `./dist/${file}.${BROWSER_TARGET}.js`,
          default: `./dist/${file}.js`
        }
      }
      const sFiles = [...serverFiles].sort()
      for (const file of sFiles) {
        exports[`./${file}`] = {
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

function jsEntry({watch, test}) {
  return {
    name: JS_ENTRY,
    setup(build) {
      let context,
        currentFiles = []
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
            if (!test && file.endsWith('.test.ts')) return false
            return !file.endsWith('.d.ts') && !file.endsWith('.stories.tsx')
          })
          if (!context || !dequal(currentFiles, files)) {
            context = await esbuild.context({
              plugins: [sassJsPlugin, internalPlugin, externalize, cleanup],
              format: 'esm',
              entryPoints: files,
              outdir: 'dist',
              bundle: true,
              splitting: true,
              treeShaking: true,
              external,
              chunkNames: 'chunks/[name]-[hash]',
              metafile: true
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

async function processScss(file) {
  const prev = sassCache.get(file)
  if (prev) {
    const key = hash(prev.watchFiles)
    if (key === prev.key) return prev
  }
  const {css, loadedUrls, sourceMap} = sass.compile(file, scssOptions)
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

const devPlugin = {
  name: 'dev',
  setup(build) {
    let isStarted = false
    build.onEnd(res => {
      if (isStarted) return
      if (res.errors.length > 0) return
      const cmd = forwardCmd()
      const rest = cmd ? ` -- ${cmd}` : ''
      spawn(`node dev.js ${rest}`, {
        stdio: 'inherit',
        shell: true
      })
      isStarted = true
    })
  }
}

const dev = process.argv.includes('--dev')
const watch = dev || process.argv.includes('--watch')
const test = process.argv.includes('--test')

async function build() {
  const plugins = [
    targetPlugin,
    cssEntry,
    sassCssPlugin,
    cleanup,
    jsEntry({watch, test}),
    bundleTs,
    ReporterPlugin.configure({name: 'alinea'})
  ]

  if (dev) plugins.push(devPlugin)

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
    sourcemap: dev,
    plugins
  })
  return watch
    ? context.watch()
    : context.rebuild().then(() => context.dispose())
}

await build()

async function runTests() {
  const filter = process.argv[3] || ''
  const files = glob.sync('dist/**/*.test.js')
  const modules = files.filter(file => {
    if (!filter) return true
    return path.basename(file).toLowerCase().includes(filter)
  })
  if (modules.length === 0) {
    console.log(`No tests found for pattern "${filter}"`)
    process.exit()
  }
  process.argv.push('.bin/uvu') // Trigger isCLI
  const {exec} = await import('uvu')
  globalThis.UVU_DEFER = 1
  for (const [idx, m] of modules.entries()) {
    globalThis.UVU_INDEX = idx
    globalThis.UVU_QUEUE.push([path.basename(m)])
    await import('./' + m)
  }
  return exec().catch(error => {
    console.error(error.stack || error.message)
    process.exit(1)
  })
}

if (test) await runTests()
