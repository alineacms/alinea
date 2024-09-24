import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
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
  const {rootDir, outDir, configLocation, watch} = ctx
  const views = new Set(
    Config.views(cms.config).filter(Boolean) as Array<string>
  )
  const entry =
    [...views]
      .map((view, index) => {
        const separatorIndex = view.slice(1).lastIndexOf('#')
        const pkg =
          separatorIndex > -1 ? view.slice(0, separatorIndex + 1) : view
        const name =
          separatorIndex > -1 ? view.slice(separatorIndex + 2) : 'default'
        const alias = `view${index}`
        return `import {${name} as ${alias}} from ${JSON.stringify(pkg)}`
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

  if (!watch) {
    await esbuild.build(config)
    return
  }
  const context = await esbuild.context(config)
  context.watch()
  return () => context.dispose()
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
    sourcemap: true,
    plugins: [
      ...config.plugins!,
      {
        name: 'emit',
        setup(build) {
          let cancelWatch: (() => Promise<void>) | undefined
          build.onStart(() => {
            if (cancelWatch) return cancelWatch()
          })
          build.onEnd(async res => {
            if (res.errors.length) {
              console.log('> Could not compile Alinea config')
            } else {
              const cms = await loadCMS(outDir)
              cancelWatch = await compileViews(ctx, cms)
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
    esbuild.build(config)
  }
  return results
}
