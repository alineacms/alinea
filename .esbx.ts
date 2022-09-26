import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {StaticPlugin} from '@esbx/static'
import {findNodeModules} from '@esbx/util'
import {getWorkspaces, TestTask} from '@esbx/workspaces'
import type {BuildOptions} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import path from 'node:path'
import {BuildTask} from './.esbx/build'
import {cssPlugin} from './.esbx/plugin/css'
import {internalPlugin} from './.esbx/plugin/internal'
import {resolvePlugin} from './.esbx/plugin/resolve'
import {sassPlugin} from './.esbx/plugin/sass'
import {staticPlugin} from './.esbx/plugin/static'

export {VersionTask} from '@esbx/workspaces'
export * from './.esbx/bundle-ts'

const buildOptions: BuildOptions = {
  jsx: 'automatic',
  format: 'esm',
  plugins: [staticPlugin, sassPlugin],
  loader: {
    '.woff': 'file',
    '.woff2': 'file',
    '.json': 'json'
  }
}

const builder = BuildTask.configure({
  exclude: ['@alinea/web', '@alinea/demo', '@alinea/css'],
  buildOptions: {
    ...buildOptions,
    plugins: [...buildOptions.plugins!, cssPlugin, resolvePlugin]
  }
})

export const buildTask = {
  ...builder,
  async action(options: any) {
    const skipTypes =
      'skip-types' in options ? options['skip-types'] : fs.existsSync('dist')
    await builder.action({
      ...options,
      'skip-types': skipTypes
    })
  }
}

const modules = findNodeModules(process.cwd())

export const dev = {
  options: [['-p, --production', 'Use production backend']],
  async action(options) {
    // await buildTask.action({watch: true, silent: true})
    const out = 'file://' + path.resolve('dist/out/cli/src/bin.js')
    const serverOptions: BuildOptions = {
      ...buildOptions,
      ignoreAnnotations: true,
      platform: 'node',
      entryPoints: ['.esbx/dev.ts'],
      outExtension: {'.js': '.mjs'},
      bundle: true,
      outdir: 'dist',
      sourcemap: true,
      external: modules,
      watch: true,
      plugins: [
        ...buildOptions.plugins!,
        ReporterPlugin.configure({name: 'server'}),
        // --experimental-specifier-resolution=node
        RunPlugin.configure({
          cmd: 'node dist/dev.mjs' + (options.production ? ' --production' : '')
        }),
        internalPlugin
      ],
      define: {
        'import.meta.url': JSON.stringify(out)
      }
    }
    return build(serverOptions)
  }
}

export const clean = {
  action() {
    fs.removeSync('dist')
    fs.removeSync('.wireit')
    fs.removeSync('apps/web/.alinea')
    fs.removeSync('apps/demo/.alinea')
    for (const location of getWorkspaces(process.cwd())) {
      fs.removeSync(`${location}/dist`)
    }
  }
}

const testTask = TestTask.configure({
  buildOptions: {
    ...buildOptions,
    platform: 'node',
    external: modules
      .filter(m => !m.includes('@alinea'))
      .concat('@alinea/sqlite-wasm'),
    plugins: [
      ...buildOptions.plugins!,
      StaticPlugin.configure({
        sources: ['packages/cli/src/Init.ts']
      }),
      internalPlugin
    ]
  }
})

export const test = {
  ...testTask,
  async action(options: any) {
    return testTask.action(options)
  }
}
