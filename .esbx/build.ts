import {ExtensionPlugin} from '@esbx/extension'
import {ReporterPlugin} from '@esbx/reporter'
import {TargetPlugin} from '@esbx/target'
import {list, reportTime} from '@esbx/util'
import {getManifest, getWorkspaces} from '@esbx/workspaces'
import {execSync} from 'child_process'
import {build, BuildOptions} from 'esbuild'
import {Task} from 'esbx'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import {tsconfigResolverSync, TsConfigResult} from 'tsconfig-resolver'
import which from 'which'
import {bundleTs} from './bundle-ts'
import {distPlugin} from './plugin/dist'

export type BuildTaskConfig = {
  /** Exclude workspaces from building */
  exclude?: Array<string>
  buildOptions?: BuildOptions
}

export type BuildTaskOptions = {
  watch?: boolean
  'skip-types'?: boolean
  silent?: boolean
}

function createTypes() {
  const tsc = which.sync('tsc')
  return reportTime(
    async () => {
      execSync(tsc, {stdio: 'inherit', cwd: process.cwd()})
    },
    'type checking',
    err => {
      if (err) return `type errors found`
      return `types built`
    }
  )
}

function task(
  config: BuildTaskConfig = {}
): Task<(options: BuildTaskOptions) => Promise<void>> {
  const excluded = new Set(config.exclude || [])
  return {
    command: 'build',
    description: 'Build workspaces',
    options: [
      ['-w, --watch', 'Rebuild on source file changes'],
      ['-sk, --skip-types', 'Skip generating typescript types']
    ],
    async action(options) {
      const cwd = process.cwd()
      const selected = process.argv.slice(3).filter(arg => !arg.startsWith('-'))
      const skipTypes = options['skip-types'] || !fs.existsSync('tsconfig.json')
      const workspaces = getWorkspaces(cwd)
      let tsConfig: TsConfigResult | undefined = undefined
      if (!skipTypes) {
        tsConfig = tsconfigResolverSync()
        await createTypes()
        await reportTime(
          async () => bundleTs.action(),
          'bundling types',
          err => {
            if (err) return `type bundling failed`
            return `types bundled`
          }
        )
      }
      const entryPoints: Array<string> = []
      function packageEntryPoints(root: string, location: string) {
        const cwd = path.join(root, location)
        const entryPoints = glob.sync('src/**/*.{ts,tsx}', {cwd})
        return entryPoints
          .filter(entry => {
            if (entry.endsWith('.d.ts')) return false
            if (entry.endsWith('.server.ts')) return false
            if (entry.endsWith('.client.tsx')) return false
            if (entry.endsWith('.stories.tsx')) return false
            return true
          })
          .map(entry => path.join(cwd, entry))
      }
      for (const workspace of workspaces) {
        const meta = getManifest(workspace)
        const isSelected =
          meta &&
          !excluded.has(meta.name) &&
          (selected.length > 0
            ? selected.some(w => workspace.includes(w))
            : true)
        if (isSelected) entryPoints.push(...packageEntryPoints(cwd, workspace))
      }
      const buildOptions: BuildOptions = {
        platform: 'neutral',
        format: 'esm',
        outdir: 'dist/out',
        bundle: true,
        // sourcemap: true,
        absWorkingDir: cwd,
        entryPoints: entryPoints,
        watch: options.watch,
        mainFields: ['module', 'main'],
        ...config.buildOptions,
        plugins: list(
          TargetPlugin.configure({
            info: file => {
              const parts = file.split(path.sep)
              const packagesPart = parts.findIndex(part => part === 'packages')
              const srcPart = parts.findIndex(part => part === 'src')
              const pkg = parts.slice(packagesPart + 1, srcPart)
              return {
                packageName: `@alinea/${pkg.join('.')}`,
                packageRoot: `./dist/out/${pkg.join('/')}/src`
              }
            },
            buildOptions: {
              plugins: [ExtensionPlugin]
            }
          }),
          config.buildOptions?.plugins || [ExtensionPlugin],
          distPlugin,
          options.silent
            ? undefined
            : ReporterPlugin.configure({name: 'packages'})
        )
      }
      await build(buildOptions)
    }
  }
}

export const BuildTask = {...task(), configure: task}
