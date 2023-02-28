import esbuild, {BuildOptions, BuildResult} from 'esbuild'
import fs from 'fs-extra'
import path from 'node:path'
import {createEmitter} from '../util/Emitter.js'
import {externalPlugin} from '../util/ExternalPlugin.js'
import {ignorePlugin} from '../util/IgnorePlugin.js'
import {publicDefines} from '../util/PublicDefines.js'
import {targetPlugin} from '../util/TargetPlugin.js'
import {GenerateContext} from './GenerateContext.js'

// Workaround evanw/esbuild#2460
function overrideTsConfig(cwd: string): string | undefined {
  const overrideLocation = path.join(cwd, 'tsconfig.alinea.json')
  // Did we already extend?
  if (fs.existsSync(overrideLocation)) return overrideLocation
  // Do we have an existing tsconfig to extend?
  const tsConfig = path.join(cwd, 'tsconfig.json')
  const hasTsConfig = fs.existsSync(tsConfig)
  if (hasTsConfig) {
    // Unfortunately the only way to overwrite the jsx setting is to provide
    // esbuild with a path to another tsconfig file within the same dir
    // We used to check the jsx value here before, but it requires a bunch of
    // dependencies to read it correctly, so always overriding is much easier
    const extendedConfig = {
      extends: './tsconfig.json',
      compilerOptions: {jsx: 'react-jsx'}
    }
    fs.writeFileSync(overrideLocation, JSON.stringify(extendedConfig, null, 2))
    return overrideLocation
  }
}

function failOnBuildError(build: Promise<BuildResult>) {
  return build.catch(error => {
    // Ignore build error because esbuild reports it to stderr
    process.exit(1)
  })
}

export function compileConfig({
  cwd,
  outDir,
  configLocation,
  watch
}: GenerateContext) {
  const tsconfig = overrideTsConfig(cwd)
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
    platform: 'node',
    jsx: 'automatic',
    define,
    plugins: [
      targetPlugin(file => {
        return {
          packageName: '@alinea/content',
          packageRoot: outDir
        }
      }),
      externalPlugin(cwd),
      ignorePlugin,
      {
        name: 'emit',
        setup(build) {
          build.onEnd(res => {
            if (res.errors.length) {
              console.log('> config has errors')
            } else {
              results.emit(res)
            }
          })
        }
      }
    ],
    tsconfig
  }
  esbuild.context(config).then(context => {
    if (!watch) context.rebuild()
    else context.watch()
  })
  return results
}
