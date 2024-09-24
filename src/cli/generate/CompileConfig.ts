import {CMS} from 'alinea/core/CMS'
import {Schema} from 'alinea/core/Schema'
import {code} from 'alinea/core/util/CodeGen'
import esbuild, {BuildOptions} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {createEmitter, Emitter} from '../util/Emitter.js'
import {externalPlugin} from '../util/ExternalPlugin.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {GenerateContext} from './GenerateContext.js'
import {loadCMS} from './LoadConfig.js'

async function compileViews(ctx: GenerateContext, cms: CMS) {
  const {rootDir, outDir, configLocation} = ctx
  const views = Schema.views(cms.config.schema)
  const entry =
    [...views]
      .map((view, index) => {
        const separatorIndex = view.slice(1).lastIndexOf('#')
        const pkg =
          separatorIndex > -1 ? view.slice(0, separatorIndex + 1) : view
        const name =
          separatorIndex > -1 ? view.slice(separatorIndex + 2) : 'default'
        const alias = `view${index}`
        return `export {${name} as ${JSON.stringify(
          view
        )}} from ${JSON.stringify(pkg)}`
      })
      .join('\n') +
    '\n' +
    code`export const views = {
      ${[...views]
        .map((view, index) => {
          const alias = `view${index}`
          return `  ${JSON.stringify(view)}: ${alias}`
        })
        .join(',\n')}
    }`
  const config: BuildOptions = {
    ...buildConfig(ctx),
    outfile: path.join(outDir, 'views.js'),
    stdin: {
      contents: entry,
      resolveDir: rootDir,
      sourcefile: configLocation,
      loader: 'ts'
    }
  }
  return esbuild.build(config)
}

function buildConfig(ctx: GenerateContext): BuildOptions {
  const {rootDir, outDir} = ctx
  const tsConfigFile = path.join(rootDir, 'tsconfig.json')
  const define = publicDefines(process.env)
  return {
    color: true,
    format: 'esm',
    target: 'esnext',
    treeShaking: true,
    bundle: true,
    logOverride: {
      'ignored-bare-import': 'silent'
    },
    platform: 'neutral',
    jsx: 'automatic',
    sourcemap: true,
    define,
    loader: {
      '.module.css': 'local-css',
      '.css': 'css'
    },
    plugins: [externalPlugin(rootDir), ignorePlugin],
    tsconfig: fs.existsSync(tsConfigFile) ? tsConfigFile : undefined
  }
}

export function compileConfig(ctx: GenerateContext): Emitter<CMS> {
  const {outDir, watch, configLocation} = ctx
  const results = createEmitter<CMS>()
  let config = buildConfig(ctx)
  config = {
    ...config,
    outdir: outDir,
    entryPoints: {config: configLocation},
    plugins: [
      ...config.plugins!,
      {
        name: 'emit',
        setup(build) {
          build.onEnd(async res => {
            if (res.errors.length) {
              console.log('> Could not compile Alinea config')
            } else {
              const cms = await loadCMS(outDir)
              await compileViews(ctx, cms)
              results.emit(cms)
              if (!watch) results.return()
            }
          })
        }
      }
    ]
  }
  if (watch) {
    esbuild.context(config).then(context => context.watch())
  } else {
    esbuild.build(config).catch(() => {})
  }
  return results
}
