import {ReporterPlugin} from '@esbx/reporter'
import {list} from '@esbx/util'
import {spawn} from 'child_process'
import type {BuildOptions} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import glob from 'glob'
import {cssPlugin} from './src/dev/css.js'
import {internalPlugin} from './src/dev/internal.js'
import {resolvePlugin} from './src/dev/resolve'
import {sassPlugin} from './src/dev/sass.js'
import {viewsPlugin} from './src/dev/views.js'

export {VersionTask} from '@esbx/workspaces'
export * from './src/dev/bundle-ts.js'

const buildOptions: BuildOptions = {
  jsx: 'automatic',
  format: 'esm',
  plugins: [sassPlugin],
  loader: {
    '.d.ts': 'copy',
    '.woff2': 'copy'
  }
}

import {reportTime} from '@esbx/util'
import {execSync} from 'child_process'
import which from 'which'

function createTypes() {
  const tsc = which.sync('tsc') as string
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

function release({
  command,
  watch,
  config
}: {
  command: string
  watch: boolean
  config: Partial<BuildOptions>
}) {
  return {
    command,
    description: 'Build workspaces',
    options: [['-w, --watch', 'Rebuild on source file changes']],
    async action(options) {
      if (!fs.existsSync('./dist/index.d.ts')) await createTypes()
      const cwd = process.cwd()
      const entryPoints = glob
        .sync('src/**/*.{ts,tsx}', {cwd})
        .filter(entry => {
          if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx'))
            return false
          if (entry.endsWith('.stories.tsx')) return false
          return true
        })
      const staticFolders = glob.sync('src/**/static', {cwd})
      for (const folder of staticFolders) {
        const target = folder.replace('src/', 'dist/')
        fs.copySync(folder, target)
      }
      await build({
        ...config,
        platform: 'neutral',
        format: 'esm',
        outdir: 'dist',
        bundle: true,
        // sourcemap: true,
        absWorkingDir: cwd,
        entryPoints: entryPoints,
        watch: watch || options.watch,
        mainFields: ['module', 'main'],
        ...buildOptions,
        plugins: list(
          buildOptions.plugins,
          cssPlugin,
          viewsPlugin,
          internalPlugin,
          resolvePlugin,
          options.silent
            ? undefined
            : ReporterPlugin.configure({name: 'alinea'}),
          config.plugins
        )
      })
    }
  }
}
export const BuildTask = release({command: 'build', watch: false, config: {}})
let devProcess
export const DevTask = release({
  command: 'dev',
  watch: true,
  config: {
    plugins: [
      {
        name: 'start',
        setup(build) {
          build.onEnd(() => {
            if (devProcess) return
            devProcess = spawn('node ./dist/dev/serve.js', {
              stdio: 'inherit',
              shell: true
            })
          })
        }
      }
    ]
  }
})

export const clean = {
  action() {
    fs.removeSync('dist')
    fs.removeSync('apps/web/.alinea')
    fs.removeSync('apps/demo/.alinea')
  }
}

/*
const testTask = TestTask.configure({
  buildOptions: {
    ...buildOptions,
    platform: 'node',
    external: modules
      .filter(m => !m.includes('@alinea'))
      .concat('@alinea/sqlite-wasm'),
    plugins: [...buildOptions.plugins!, internalPlugin]
  }
})

export const test = {
  ...testTask,
  async action(options: any) {
    return testTask.action(options)
  }
}
*/
