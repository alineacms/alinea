import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {list} from '@esbx/util'
import type {BuildOptions} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import glob from 'glob'
import {cssPlugin} from './src/dev/css'
import {resolvePlugin} from './src/dev/resolve'
import {sassPlugin} from './src/dev/sass'

export {VersionTask} from '@esbx/workspaces'
export * from './src/dev/bundle-ts'

const buildOptions: BuildOptions = {
  jsx: 'automatic',
  format: 'esm',
  plugins: [sassPlugin],
  loader: {
    '.woff': 'file',
    '.woff2': 'file',

    // All file extensions of the files in /static
    '.json': 'copy',
    '.html': 'copy',
    '.js': 'copy',
    '.cjs': 'copy',
    '.d.ts': 'copy',
    '.css': 'copy'
  }
}

function release(config: Partial<BuildOptions> = {}) {
  return {
    command: 'build',
    description: 'Build workspaces',
    options: [['-w, --watch', 'Rebuild on source file changes']],
    async action(options) {
      const cwd = process.cwd()
      const entryPoints = glob
        .sync('src/**/*.{ts,tsx,cjs,js,html,json,css}', {cwd})
        .filter(entry => {
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
        watch: options.watch,
        mainFields: ['module', 'main'],
        ...buildOptions,
        plugins: list(
          config.plugins,
          buildOptions.plugins,
          cssPlugin,
          resolvePlugin,
          options.silent
            ? undefined
            : ReporterPlugin.configure({name: 'packages'})
        )
      })
    }
  }
}

export const BuildTask = release()
export const DevTask = {
  ...release({
    plugins: [
      RunPlugin.configure({
        cmd: 'node ./dist/dev/serve.js'
      })
    ]
  }),
  command: 'dev'
}

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
