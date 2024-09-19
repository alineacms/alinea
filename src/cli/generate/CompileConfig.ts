import esbuild, {BuildOptions, BuildResult} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {createEmitter} from '../util/Emitter.js'
import {externalPlugin} from '../util/ExternalPlugin.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {GenerateContext} from './GenerateContext.js'

export function compileConfig({
  rootDir,
  outDir,
  configLocation,
  watch
}: GenerateContext) {
  const tsConfigFile = path.join(rootDir, 'tsconfig.json')
  const define = publicDefines(process.env)
  const results = createEmitter<BuildResult>()
  const config: BuildOptions = {
    color: true,
    format: 'esm',
    target: 'esnext',
    treeShaking: true,
    outdir: outDir,
    entryPoints: {config: configLocation},
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
    plugins: [
      externalPlugin(rootDir),
      ignorePlugin,
      {
        name: 'emit',
        setup(build) {
          build.onEnd(res => {
            if (res.errors.length) {
              console.log('> Could not compile Alinea config')
            } else {
              results.emit(res)
              if (!watch) results.return()
            }
          })
        }
      }
    ],
    tsconfig: fs.existsSync(tsConfigFile) ? tsConfigFile : undefined
  }
  if (watch) {
    esbuild.context(config).then(context => context.watch())
  } else {
    esbuild.build(config).catch(() => {})
  }
  return results
}
