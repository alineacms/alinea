import {CMS} from 'alinea/core/CMS'
import {Schema} from 'alinea/core/Schema'
import esbuild, {BuildOptions} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {createEmitter, Emitter} from '../util/Emitter.js'
import {externalPlugin} from '../util/ExternalPlugin.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {GenerateContext} from './GenerateContext.js'
import {loadCMS} from './LoadConfig.js'

export function compileConfig({
  rootDir,
  outDir,
  configLocation,
  watch
}: GenerateContext): Emitter<CMS> {
  const tsConfigFile = path.join(rootDir, 'tsconfig.json')
  const define = publicDefines(process.env)
  const results = createEmitter<CMS>()
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
          build.onEnd(async res => {
            if (res.errors.length) {
              console.log('> Could not compile Alinea config')
            } else {
              const cms = await loadCMS(outDir)
              console.log(Schema.views(cms.config.schema))
              results.emit(cms)
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
