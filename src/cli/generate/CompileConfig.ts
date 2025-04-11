import fs from 'node:fs'
import path from 'node:path'
import type {BuildOptions} from 'esbuild'
import {buildEmitter} from '../build/BuildEmitter.js'
import {buildOptions} from '../build/BuildOptions.js'
import {externalPlugin} from '../util/ExternalPlugin.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {reportError, reportFatal} from '../util/Report.js'
import type {GenerateContext} from './GenerateContext.js'
import {loadCMS} from './LoadConfig.js'

function buildConfig(ctx: GenerateContext): BuildOptions {
  const {rootDir} = ctx
  const tsConfigFile = path.join(rootDir, 'tsconfig.json')
  const define = publicDefines(process.env)
  return {
    ...buildOptions,
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
    plugins: [externalPlugin(rootDir), ignorePlugin],
    tsconfig: fs.existsSync(tsConfigFile) ? tsConfigFile : undefined
  }
}

export async function* compileConfig(ctx: GenerateContext) {
  const {outDir, configLocation, cmd} = ctx
  const config = buildConfig(ctx)
  const location = path
    .relative(process.cwd(), configLocation)
    .replace(/\\/g, '/')
  const builds = buildEmitter({
    ...config,
    outdir: outDir,
    entryPoints: {config: configLocation},
    sourcemap: true
  })
  const halt = (error: Error) => {
    reportError(error)
    if (cmd === 'dev') return
    builds.return()
  }
  for await (const {type, result} of builds) {
    if (type !== 'done') continue
    if (result.errors.length) {
      reportFatal(`Could not compile Alinea config file @ ${location}`)
      continue
    }
    try {
      yield await loadCMS(outDir)
    } catch (error: any) {
      const message = 'message' in error ? error.message : error
      halt(new Error(`${message} @ ${location}`, {cause: error}))
    }
  }
}
