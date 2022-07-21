import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {StaticPlugin} from '@esbx/static'
import {findNodeModules, reportTime} from '@esbx/util'
import {getWorkspaces, TestTask} from '@esbx/workspaces'
import {execSync} from 'child_process'
import semver from 'compare-versions'
import type {BuildOptions} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import path from 'node:path'
import {BuildTask} from './.esbx/build'
import {bundleTs} from './.esbx/bundle-ts'
import {cssPlugin} from './.esbx/plugin/css'
import {internalPlugin} from './.esbx/plugin/internal'
import {resolvePlugin} from './.esbx/plugin/resolve'
import {sassPlugin} from './.esbx/plugin/sass'
import {staticPlugin} from './.esbx/plugin/static'
import {ensureNodeResolution} from './packages/cli/src/util/EnsureNodeResolution'

export {VersionTask} from '@esbx/workspaces'
export * from './.esbx/bundle-ts'

const buildOptions: BuildOptions = {
  format: 'esm',
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
  async action({checkTypeDoc = true}) {
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
    if (checkTypeDoc && !fs.existsSync('apps/web/src/data/types.json')) {
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
    if (!fs.existsSync('dist/alinea.d.ts')) {
      await bundleTs.action()
    }
  }
}

const modules = findNodeModules(process.cwd())

export const dev = {
  options: [['-p, --production', 'Use production backend']],
  async action(options) {
    await buildTask.action({watch: true, silent: true})
    const out = 'file://' + path.resolve('dist/cli/src/bin.js')
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
    fs.removeSync('apps/web/.alinea')
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
        sources: [
          'packages/cli/src/Init.ts',
          'packages/cli/src/export/ExportStore.ts'
        ]
      }),
      internalPlugin
    ]
  }
})

export const test = {
  ...testTask,
  async action(options: any) {
    ensureNodeResolution()
    await prepare.action({checkTypeDoc: false})
    return testTask.action(options)
  }
}
