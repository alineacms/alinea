import {ExtensionPlugin} from '@esbx/extension'
import {ReporterPlugin} from '@esbx/reporter'
import {reportTime} from '@esbx/util'
import {getManifest, getWorkspaces} from '@esbx/workspaces'
import {execSync} from 'child_process'
import {build, BuildOptions} from 'esbuild'
import {Task} from 'esbx'
import fs from 'fs-extra'
import glob from 'glob'
import path from 'path'
import {tsconfigResolverSync, TsConfigResult} from 'tsconfig-resolver'
import which from 'which'
import {distPlugin} from './plugin/dist'

export type BuildTaskConfig = {
  /** Exclude workspaces from building */
  exclude?: Array<string>
  buildOptions?: BuildOptions
}

export type BuildTaskOptions = {
  watch?: boolean
  'skip-types'?: boolean
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
      }
      const entryPoints = []
      function packageEntryPoints(root: string, location: string) {
        const cwd = path.join(root, location)
        const entryPoints = glob.sync('src/**/*.{ts,tsx}', {cwd})
        return entryPoints
          .filter(entry => !entry.endsWith('.d.ts'))
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
      await build({
        format: 'esm',
        outdir: 'dist',
        bundle: true,
        sourcemap: true,
        absWorkingDir: cwd,
        entryPoints: entryPoints,
        watch: options.watch,
        ...config.buildOptions,
        plugins: (config.buildOptions?.plugins || [ExtensionPlugin]).concat(
          distPlugin,
          ReporterPlugin.configure({name: 'packages'})
        )
      })
    }
  }
}

export const BuildTask = {...task(), configure: task}
