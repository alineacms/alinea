import {ReporterPlugin} from '@esbx/reporter'
import {list} from '@esbx/util'
import {spawn} from 'child_process'
import type {BuildOptions} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import glob from 'glob'
import {bundleTsPlugin} from './src/dev/bundle-ts.js'
import {cssPlugin} from './src/dev/css.js'
import {internalPlugin} from './src/dev/internal.js'
import {resolvePlugin} from './src/dev/resolve'
import {sassPlugin} from './src/dev/sass.js'

export {VersionTask} from '@esbx/workspaces'
export * from './src/dev/bundle-ts.js'

const buildOptions: BuildOptions = {
  jsx: 'automatic',
  format: 'esm',
  plugins: [sassPlugin],
  loader: {
    '.woff2': 'copy',
    '.d.ts': 'copy'
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
        .sync('src/**/*.{ts,tsx,js}', {cwd})
        .filter(entry => {
          if (entry.includes('/static/')) return false
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
          internalPlugin,
          resolvePlugin,
          options.silent
            ? undefined
            : ReporterPlugin.configure({name: 'alinea'}),
          bundleTsPlugin,
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

import {StaticPlugin} from '@esbx/static'
import {findNodeModules} from '@esbx/util'
import crypto from 'crypto'
import path from 'path'

export type TestTaskConfig = {
  globPattern?: string
  buildOptions?: BuildOptions
}

export const TestTask = {
  command: 'test [pattern]',
  describe: 'Test workspaces',
  async action(pattern?: string) {
    const cwd = process.cwd()
    const filter = (pattern || 'Test').toLowerCase()
    const files = glob.sync('src/**/*.test.{ts,tsx}', {cwd})
    const modules = files.filter(file => {
      return path.basename(file).toLowerCase().includes(filter)
    })
    if (modules.length === 0) {
      console.log(`No tests found for pattern "${filter}"`)
      process.exit()
    }
    const suites = modules
      .map(
        (m, idx) => `
            globalThis.UVU_INDEX = ${idx}
            globalThis.UVU_QUEUE.push([${JSON.stringify(path.basename(m))}])
            await import(${JSON.stringify('./' + m)})
          `
      )
      .join('\n')
    const entry = `
        const {exec} = await import('uvu')
        globalThis.UVU_DEFER = 1;
        ${suites}
        exec().catch(error => {
          console.error(error.stack || error.message)
          process.exit(1)
        })
      `
    const external = findNodeModules(process.cwd())
    const outfile = path.posix.join(
      process.cwd(),
      'node_modules',
      crypto.randomBytes(16).toString('hex') + '.mjs'
    )
    await build({
      bundle: true,
      format: 'esm',
      platform: 'node',
      external,
      outfile,
      banner: {
        js: `import "data:text/javascript,process.argv.push('.bin/uvu')" // Trigger isCLI`
      },
      plugins: list(
        StaticPlugin.configure({
          sources: modules
        })
      ),
      stdin: {
        contents: entry,
        resolveDir: process.cwd(),
        sourcefile: 'test.js'
      }
    })
    await import(`file://${outfile}`).finally(() => fs.promises.unlink(outfile))
  }
}
