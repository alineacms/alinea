import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {StaticPlugin} from '@esbx/static'
import {findNodeModules, reportTime} from '@esbx/util'
import {getWorkspaces, TestTask} from '@esbx/workspaces'
import {execSync} from 'child_process'
import semver from 'compare-versions'
import type {BuildOptions, Plugin} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import {BuildTask} from './.esbx/build'
import {cssPlugin} from './.esbx/plugin/css'
import {internalPlugin} from './.esbx/plugin/internal'
import {resolvePlugin} from './.esbx/plugin/resolve'
import {sassPlugin} from './.esbx/plugin/sass'
import {staticPlugin} from './.esbx/plugin/static'
import {ensureNodeResolution} from './packages/cli/src/util/EnsureNodeResolution'
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
    const minVersion = '14.18.0'
    const nodeVersionWorks = semver.compare(
      process.version.slice(1),
      minVersion,
      '>='
    )
    if (!nodeVersionWorks) {
      console.error(
        `Node version ${process.version} is not supported, at least ${minVersion} is required.`
      )
      process.exit(1)
    }
    if (!fs.existsSync('dist')) await buildTask.action({})
    if (!fs.existsSync('apps/web/src/data/types.json')) {
      reportTime(
        async () => {
          execSync(
            `typedoc --json apps/web/src/data/types.json --logLevel Error`,
            {
              stdio: 'inherit'
            }
          )
        },
        'generating typedoc json...',
        err => 'typedoc completed'
      )
    }
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

const testTask = TestTask.configure({
  buildOptions: {
    ...buildOptions,
    external: modules
      .filter(m => !m.includes('@alinea'))
      .concat('@alinea/sqlite-wasm'),
    plugins: [
      ...buildOptions.plugins!,
      StaticPlugin.configure({sources: ['packages/cli/src/Init.ts']}),
      internalPlugin,
      FixReactIconsPlugin
    ]
  }
})

export const test = {
  ...testTask,
  async action(options: any) {
    ensureNodeResolution()
    await prepare.action()
    return testTask.action(options)
  }
}

export const mkid = {
  action() {
    console.log(createId())
  }
}
