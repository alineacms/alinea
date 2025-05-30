import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import postcss from 'postcss'
import postcssModules from 'postcss-modules'
import pxtorem from 'postcss-pxtorem'
import * as sass from 'sass-embedded'

export default {
  name: 'js-sass',
  setup(build) {
    build.onResolve({filter: /\.scss$/}, args => {
      return {
        ...args,
        path: args.importer.endsWith('css')
          ? args.path
          : path.join(args.resolveDir, args.path),
        namespace: args.importer.endsWith('css') ? 'css-sass' : 'js-sass'
      }
    })
    build.onLoad({filter: /.*$/, namespace: 'css-sass'}, async args => {
      try {
        const {css, watchFiles} = await processScss(args.path)
        console.log(watchFiles)
        return {contents: css, loader: 'css', watchFiles}
      } catch (error) {
        console.error(`Error processing SCSS file: ${args.path}`, error)
      }
    })
    build.onLoad({filter: /\.scss$/, namespace: 'js-sass'}, async args => {
      try {
        const {isModule, json, watchFiles} = await processScss(args.path)
        if (!isModule) return {contents: '', loader: 'js', watchFiles}
        return {contents: json, loader: 'js', watchFiles}
      } catch (error) {
        console.error(`Error processing SCSS file: ${args.path}`, error)
      }
    })
  }
}

const isWindows = process.platform === 'win32'
const prefix = 'alinea/'

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

const sassExports = new Map()
const sassCache = new Map()

function hash(files: Array<string>) {
  return files.map(file => fs.statSync(file).mtimeMs).join('-')
}

const sassCompiler = await sass.initAsyncCompiler()

const scssOptions: sass.Options<'async'> = {
  loadPaths: ['node_modules'],
  quietDeps: true,
  silenceDeprecations: ['import'],
  importers: [
    {
      findFileUrl(url) {
        if (!url.startsWith(prefix)) return null
        return pathToFileURL('../src/' + url.slice(prefix.length)) as URL
      }
    }
  ]
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
