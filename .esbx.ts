import {ReporterPlugin} from '@esbx/reporter'
import {list} from '@esbx/util'
import {spawn} from 'child_process'
import type {BuildOptions} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import glob from 'glob'
import {cssPlugin} from './src/dev/css.js'
import {resolvePlugin} from './src/dev/resolve.js'
import {sassPlugin} from './src/dev/sass.js'

export {VersionTask} from '@esbx/workspaces'
export * from './src/dev/bundle-ts.js'

const buildOptions: BuildOptions = {
  jsx: 'automatic',
  format: 'esm',
  plugins: [sassPlugin],
  loader: {
    // All file extensions of the files in /static
    '.json': 'copy',
    '.html': 'copy',
    '.js': 'copy',
    '.cjs': 'copy',
    '.d.ts': 'copy',
    '.css': 'copy',
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
        .sync('src/**/*.{ts,tsx,cjs,js,html,css,woff2}', {cwd})
        .filter(entry => {
          if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx'))
            return false
          if (entry.endsWith('.stories.tsx')) return false
          return true
        })
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
