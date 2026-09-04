import fs from 'node:fs'
import path from 'node:path'
import type {BuildOptions} from 'esbuild'
import {buildEmitter} from '../build/BuildEmitter.js'
import {buildOptions} from '../build/BuildOptions.js'
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
    alias: {'alinea/next': 'alinea/core'},
    packages: 'external',
    logOverride: {
      'ignored-bare-import': 'silent'
    },
    platform: 'neutral',
    jsx: 'automatic',
    define,
    plugins: [ignorePlugin],
    tsconfig: fs.existsSync(tsConfigFile) ? tsConfigFile : undefined
  }
}

export async function* compileConfig(ctx: GenerateContext) {
  const {bundleDir, configLocation, cmd} = ctx
  const config = buildConfig(ctx)
  const location = path
    .relative(process.cwd(), configLocation)
    .replace(/\\/g, '/')
  const builds = buildEmitter({
    ...config,
    outdir: bundleDir,
    entryPoints: {'server-config': configLocation},
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
      yield await loadCMS(bundleDir)
    } catch (error: any) {
      const message = 'message' in error ? error.message : error
      halt(new Error(`${message} @ ${location}`, {cause: error}))
    }
  }
}
