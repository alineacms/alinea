// Modified from: https://github.com/ictrobot/esbuild-scss-modules-plugin
// a02c9ca4f0610a5596b7180470c8b24c6a90f4d6
// MIT License

import type * as esbuild from 'esbuild'
import fs from 'fs/promises'
import path from 'path'
import postcss from 'postcss'
import {default as postcssModules} from 'postcss-modules'
import * as sass from 'sass'

const PLUGIN = 'esbuild-scss-modules-plugin'

type CssModulesOptions = Parameters<postcssModules>[0]
export type PluginOptions = {
  inject: boolean
  minify: boolean
  cache: boolean

  localsConvention: CssModulesOptions['localsConvention']
  generateScopedName: CssModulesOptions['generateScopedName']

  scssOptions: sass.Options
}
const DefaultOptions: PluginOptions = {
  inject: true,
  minify: false,
  cache: true,

  localsConvention: 'camelCaseOnly',
  generateScopedName: undefined,

  scssOptions: {}
}

async function buildScss(
  scssFullPath: string,
  sassOptions: sass.Options
): Promise<sass.Result> {
  return new Promise((resolve, reject) =>
    sass.render(
      {
        file: scssFullPath,
        ...sassOptions
      },
      (err, result) => (err ? reject(err) : resolve(result))
    )
  )
}

function stripModule(file: string) {
  return file.endsWith('.module')
    ? file.substr(0, file.length - '.module'.length)
    : file
}

async function buildScssModulesJS(
  scssFullPath: string,
  options: PluginOptions
): Promise<{js: string; css: string}> {
  const css = (await buildScss(scssFullPath, options.scssOptions)).css
  const fileName = stripModule(path.basename(scssFullPath, '.scss'))
  let cssModulesJSON = {}
  const result = await postcss([
    postcssModules({
      localsConvention: options.localsConvention,
      generateScopedName: options.generateScopedName,
      getJSON(cssSourceFile, json) {
        cssModulesJSON = {...json}
        return cssModulesJSON
      }
    })
  ]).process(css, {
    from: scssFullPath,
    map: false
  })
  const classNames = JSON.stringify(cssModulesJSON)
  return {
    js: `
// import './${fileName}.css';
const classes = ${classNames};
export default classes;
  `,
    css: result.css
  }
}

export const ScssModulesPlugin = (options: Partial<PluginOptions> = {}) =>
  ({
    name: PLUGIN,
    setup(build) {
      const {outdir, bundle, absWorkingDir} = build.initialOptions
      const results = new Map()
      const fullOptions = {...DefaultOptions, ...options}

      build.onResolve(
        {filter: /\.modules?\.scss$/, namespace: 'file'},
        async args => {
          const sourceFullPath = path.resolve(args.resolveDir, args.path)
          if (results.has(sourceFullPath)) return results.get(sourceFullPath)

          const result = await (async () => {
            const sourceExt = path.extname(sourceFullPath)
            const sourceBaseName = path.basename(sourceFullPath, sourceExt)

            const {js, css} = await buildScssModulesJS(
              sourceFullPath,
              fullOptions
            )

            if (outdir) {
              const cssFile = stripModule(sourceBaseName)
              const target = path.join(absWorkingDir, outdir, `${cssFile}.css`)
              await fs.mkdir(path.dirname(target), {recursive: true})
              await fs.writeFile(target, css)
            }

            if (bundle) {
              return {
                path: args.path,
                namespace: PLUGIN,
                pluginData: {
                  content: js
                }
              }
            }

            return {path: sourceFullPath, namespace: 'file'}
          })()

          if (fullOptions.cache) results.set(sourceFullPath, result)
          return result
        }
      )

      build.onLoad({filter: /\.modules?\.scss$/, namespace: PLUGIN}, args => {
        return {contents: args.pluginData.content, loader: 'js'}
      })
    }
  } as esbuild.Plugin)

export default ScssModulesPlugin
