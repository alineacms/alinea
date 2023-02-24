import {BuildOptions, BuildResult, build} from 'esbuild'
import fs from 'fs-extra'
import path from 'node:path'
import {createEmitter} from '../util/Emitter'
import {externalPlugin} from '../util/ExternalPlugin'
import {ignorePlugin} from '../util/IgnorePlugin'
import {publicDefines} from '../util/PublicDefines'
import {targetPlugin} from '../util/TargetPlugin'
import {GenerateContext} from './GenerateContext'

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
      ignorePlugin
    ],
    watch: watch && {
      async onRebuild(error, success) {
        if (error) console.log('> config has errors')
        else results.emit(success!)
      }
    },
    tsconfig
  }
  console.log(config)
  build(config)
    .then(
      res => {
        console.log(res)
        return res
      },
      err => {
        console.error(err)
        throw err
      }
    )
    .then(results.emit, results.throw)
    .then(() => {
      if (!watch) return results.return()
    })
  return results
}
