import {ReporterPlugin} from '@esbx/reporter'
import esbuild from 'esbuild'
import glob from 'glob'
import {builtinModules} from 'module'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import postcss from 'postcss'
import postcssModules from 'postcss-modules'

// Interestingly sass seems to outperform sass-embedded about 2x
import * as sass from 'sass'

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
const cssEntry = {
  name: 'css-entry',
  setup(build) {
    build.onResolve({filter: /^alinea\/css$/}, args => ({
      path: args.path,
      namespace: 'css-entry'
    }))
    build.onLoad({filter: /^alinea\/css$/, namespace: 'css-entry'}, args => {
      const files = glob.sync('src/**/*.scss')
      const entryPoint = files
        .map(file => `@import url('./${file}');`)
        .join('\n')
      return {
        contents: entryPoint,
        loader: 'css',
        watchFiles: files,
        watchDirs: dirsOf('src'),
        resolveDir: '.'
      }
    })
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
      const file = path.join(args.resolveDir, args.path)
      const location = path
        .relative(src, file)
        .replaceAll(path.sep, '/')
        .slice(0, -'.js'.length)
      return {
        path: `alinea/${location}`,
        external: true
      }
    })
  }
}

/** @type {import('esbuild').Plugin} */
const jsEntry = {
  name: 'js-entry',
  setup(build) {
    build.onResolve({filter: /^alinea$/}, args => ({
      path: args.path,
      namespace: 'js-entry'
    }))
    build.onLoad({filter: /^alinea$/, namespace: 'js-entry'}, async args => {
      const files = glob.sync('src/**/*.{ts,tsx}').filter(file => {
        if (file.includes('dev')) return false
        return !file.endsWith('.d.ts') && !file.endsWith('.test.ts')
      })
      const result = await esbuild.build({
        plugins: [sassJsPlugin, internalPlugin, externalize],
        format: 'esm',
        entryPoints: files,
        outdir: 'dist',
        bundle: true,
        splitting: true,
        treeShaking: true,
        external,
        chunkNames: 'chunks/[name]-[hash]'
      })
      return {
        contents: '',
        resolveDir: '.'
      }
    })
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

async function buildScss() {
  const context = await esbuild.context({
    bundle: true,
    entryPoints: [
      {in: 'alinea/css', out: 'index'},
      {in: 'alinea', out: 'index'}
    ],
    outdir: 'dist',
    plugins: [
      cssEntry,
      sassCssPlugin,
      jsEntry,
      ReporterPlugin.configure({name: 'build'})
    ]
  })
  return context.watch()
}

await buildScss()
