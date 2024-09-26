import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {genEffect} from 'alinea/core/util/Async'
import {code} from 'alinea/core/util/CodeGen'
import {BuildOptions} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {BuildInfo, buildEmitter} from '../build/BuildEmitter.js'
import {Emitter} from '../util/Emitter.js'
import {externalPlugin} from '../util/ExternalPlugin.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {reportHalt} from '../util/Report.js'
import {GenerateContext} from './GenerateContext.js'
import {loadCMS} from './LoadConfig.js'

function compileViews(ctx: GenerateContext, cms: CMS) {
  const {rootDir, outDir, configLocation} = ctx
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
        const alias = `view_${index}`
        return `import {${name} as ${alias}} from ${JSON.stringify(pkg)}`
      })
      .join('\n') +
    '\n' +
    code`export const views = {
      ${[...views]
        .map((view, index) => {
          const alias = `view_${index}`
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
  return buildEmitter(config)
}

function buildConfig(ctx: GenerateContext): BuildOptions {
  const {rootDir} = ctx
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

export async function* compileConfig(ctx: GenerateContext) {
  const {outDir, configLocation, cmd} = ctx
  let config = buildConfig(ctx)
  const location = path
    .relative(process.cwd(), configLocation)
    .replace(/\\/g, '/')
  let views: Emitter<BuildInfo> | undefined
  const builder = buildEmitter({
    ...config,
    outdir: outDir,
    entryPoints: {config: configLocation},
    sourcemap: true
  })
  const builds = genEffect(builder, ({value}) => {
    if (value?.type === 'start') views?.return()
  })
  const halt = (message: string) => {
    reportHalt(message)
    if (cmd === 'dev') return
    builder.return()
    views?.return()
  }
  for await (const {type, result} of builds) {
    if (type !== 'done') continue
    if (result.errors.length) {
      halt(`Could not compile Alinea config file @ ${location}`)
      continue
    }
    try {
      const cms = await loadCMS(outDir)
      views = compileViews(ctx, cms)
      for await (const {type, result} of views) {
        if (type !== 'done') continue
        if (result.errors.length)
          halt(`Could not compile Alinea config file @ ${location}`)
        else yield cms
      }
    } catch (error: any) {
      const message = 'message' in error ? error.message : error
      halt(`${message} @ ${location}`)
    }
  }
}
