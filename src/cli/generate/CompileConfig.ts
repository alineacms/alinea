import {BuildOptions} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {buildEmitter} from '../build/BuildEmitter.js'
import {buildOptions} from '../build/BuildOptions.js'
import {externalPlugin} from '../util/ExternalPlugin.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {reportHalt} from '../util/Report.js'
import {GenerateContext} from './GenerateContext.js'
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
    alias: {
      'alinea/next': 'alinea/core'
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
  const builds = buildEmitter({
    ...config,
    outdir: outDir,
    entryPoints: {config: configLocation},
    sourcemap: true
  })
  const halt = (message: string) => {
    reportHalt(message)
    if (cmd === 'dev') return
    builds.return()
  }
  for await (const {type, result} of builds) {
    if (type !== 'done') continue
    if (result.errors.length) {
      halt(`Could not compile Alinea config file @ ${location}`)
      continue
    }
    try {
      yield await loadCMS(outDir)
    } catch (error: any) {
      const message = 'message' in error ? error.message : error
      halt(`${message} @ ${location}`)
    }
  }
}
