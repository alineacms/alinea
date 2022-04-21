import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {findNodeModules} from '@esbx/util'
import {getWorkspaces, TestTask} from '@esbx/workspaces'
import type {BuildOptions, Plugin} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import {BuildTask} from './.esbx/build'
import {cssPlugin} from './.esbx/plugin/css'
import {internalPlugin} from './.esbx/plugin/internal'
import {resolvePlugin} from './.esbx/plugin/resolve'
import {sassPlugin} from './.esbx/plugin/sass'
import {staticPlugin} from './.esbx/plugin/static'
import {createId} from './packages/core/src/Id'

export {VersionTask} from '@esbx/workspaces'

const buildOptions: BuildOptions = {
  format: 'esm',
  sourcemap: true,
  plugins: [EvalPlugin, staticPlugin, ReactPlugin, sassPlugin],
  loader: {
    '.woff': 'file',
    '.woff2': 'file',
    '.json': 'json'
  }
}

const builder = BuildTask.configure({
  exclude: ['@alinea/web', '@alinea/css'],
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

export const prepare = {
  async action() {
    if (!fs.existsSync('dist')) await buildTask.action({})
  }
}

const modules = findNodeModules(process.cwd())

const serverOptions: BuildOptions = {
  ...buildOptions,
  ignoreAnnotations: true,
  platform: 'node',
  entryPoints: ['.esbx/dev.ts'],
  outExtension: {'.js': '.mjs'},
  bundle: true,
  outdir: 'dist',
  external: modules,
  plugins: [
    ...buildOptions.plugins!,
    ReporterPlugin.configure({name: 'server'}),
    RunPlugin.configure({
      cmd: 'node --experimental-specifier-resolution=node dist/dev.mjs'
    })
  ]
}

export const dev = {
  async action() {
    await buildTask.action({watch: true, silent: true})
    return build(serverOptions)
  }
}

export const clean = {
  action() {
    fs.removeSync('dist')
    fs.removeSync('apps/web/.alinea')
    for (const location of getWorkspaces(process.cwd())) {
      fs.removeSync(`${location}/dist`)
    }
  }
}

const FixReactIconsPlugin: Plugin = {
  name: 'FixReactIconsPlugin',
  setup(build) {
    build.onResolve({filter: /react-icons.*/}, ({path}) => {
      if (!path.endsWith('index.js'))
        return {path: path + '/index.js', external: true}
    })
  }
}

export const testTask = TestTask.configure({
  buildOptions: {
    ...buildOptions,
    sourcemap: true,
    external: modules
      .filter(m => !m.includes('@alinea'))
      .concat('@alinea/sqlite-wasm'),
    plugins: [...buildOptions.plugins!, internalPlugin, FixReactIconsPlugin]
  }
})

export const mkid = {
  action() {
    console.log(createId())
  }
}
