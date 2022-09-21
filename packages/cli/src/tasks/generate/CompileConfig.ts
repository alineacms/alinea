import {externalPlugin} from '@alinea/cli/util/ExternalPlugin'
import {ignorePlugin} from '@alinea/cli/util/IgnorePlugin'
import {publicDefines} from '@alinea/cli/util/PublicDefines'
import {targetPlugin} from '@alinea/cli/util/TargetPlugin'
import {EvalPlugin} from '@esbx/eval'
import {build, BuildFailure, BuildResult} from 'esbuild'
import fs from 'fs-extra'
import path from 'node:path'
import {Signal, signal} from 'usignal'
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
    const source = fs.readJSONSync(tsConfig)
    // This is not entirely correct as it could be extending another tsconfig
    // that has this setting but we'll fix that if anyone every runs into it
    if (source.compilerOptions?.jsx !== 'react-jsx') {
      const extendedConfig = {
        extends: './tsconfig.json',
        compilerOptions: {jsx: 'react-jsx'}
      }
      fs.writeFileSync(
        overrideLocation,
        JSON.stringify(extendedConfig, null, 2)
      )
      return overrideLocation
    }
  }
}

function failOnBuildError(build: Promise<BuildResult>) {
  return build.catch(error => {
    // Ignore build error because esbuild reports it to stderr
    process.exit(1)
  })
}

interface CompileResult {
  result: Signal<BuildResult | BuildFailure>
  stop: () => void
}

export async function compileConfig({
  cwd,
  outDir,
  configLocation,
  watch
}: GenerateContext): Promise<CompileResult> {
  const tsconfig = overrideTsConfig(cwd)
  const define = publicDefines(process.env)
  const result = signal<BuildResult | BuildFailure>(undefined!)
  return build({
    format: 'esm',
    target: 'esnext',
    treeShaking: true,
    outdir: outDir,
    entryPoints: {config: configLocation},
    absWorkingDir: cwd,
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
      EvalPlugin,
      externalPlugin(cwd),
      ignorePlugin
    ],
    watch: watch && {
      async onRebuild(error, success) {
        result.value = (error || success)!
      }
    },
    tsconfig
  })
    .then(buildResult => {
      result.value = buildResult
    })
    .catch(err => {
      result.value = err as BuildFailure
    })
    .then(() => {
      return {
        result,
        stop() {
          const current = result.value
          if ('stop' in current) current.stop?.()
        }
      }
    })
}
