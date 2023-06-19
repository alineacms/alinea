import {ReporterPlugin} from '@esbx/reporter'
import esbuild from 'esbuild'
import glob from 'glob'
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

const scssOptions = {
  loadPaths: ['./node_modules'],
  importers: [resolveAlinea]
}

const postCssPlugins = [
  postcssModules({
    localsConvention: 'dashes',
    generateScopedName(name, fileName, css) {
      const module = path.basename(fileName).split('.')[0]
      if (name.startsWith('root-')) name = name.slice(5)
      if (name.startsWith('root')) name = name.slice(4)
      return `alinea-${module}${name ? '-' + name : ''}`
    },
    getJSON() {}
  })
]

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
const cssEntry = {
  name: 'css-entry',
  setup(build) {
    build.onResolve({filter: /^entry:css$/}, args => ({
      path: args.path,
      namespace: 'css-entry'
    }))
    build.onLoad({filter: /^entry:css$/, namespace: 'css-entry'}, args => {
      const files = glob.sync('src/**/*.module.scss')
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
const jsEntry = {
  name: 'js-entry',
  setup(build) {
    build.onResolve({filter: /^entry:js$/}, args => ({
      path: args.path,
      namespace: 'js-entry'
    }))
    build.onLoad({filter: /^entry:js$/, namespace: 'js-entry'}, args => {
      const files = glob.sync('src/**/*.{ts,tsx}')
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
const sassPlugin = {
  name: 'sass',
  setup(build) {
    const cache = new Map()
    build.onLoad({filter: /\.scss$/}, async args => {
      const {css, loadedUrls, sourceMap} = sass.compile(args.path, scssOptions)
      const watchFiles = loadedUrls.map(url => {
        return url.pathname.substring(isWindows ? 1 : 0)
      })
      const key = hash(watchFiles)
      const entry = cache.get(key)
      if (entry) return entry
      const processed = await postcss(postCssPlugins).process(css, {
        from: args.path,
        map: {
          inline: true,
          prev: sourceMap
        }
      })
      const result = {contents: processed.css, loader: 'css', watchFiles}
      cache.set(key, result)
      return result
    })
  }
}

async function buildScss() {
  const context = await esbuild.context({
    bundle: true,
    sourcemap: true,
    entryPoints: [{in: 'entry:css', out: 'index'}],
    outdir: 'dist',
    plugins: [cssEntry, sassPlugin, ReporterPlugin.configure({name: 'sass'})]
  })
  return context.watch()
}

await buildScss()
