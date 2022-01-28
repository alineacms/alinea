import {AliasPlugin} from '@esbx/alias'
import {ReactPlugin} from '@esbx/react'
import {ReloadPlugin} from '@esbx/reload'
import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {SassPlugin} from '@esbx/sass'
import {StaticPlugin} from '@esbx/static'
import {findNodeModules} from '@esbx/util'
import {BuildTask, getManifest, getWorkspaces, TestTask} from '@esbx/workspaces'
import type {BuildOptions, Plugin} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import path from 'path'
import {createId} from './packages/core/src/Id'

const FixReactIconsPlugin: Plugin = {
  name: 'FixReactIconsPlugin',
  setup(build) {
    build.onResolve({filter: /react-icons.*/}, ({path}) => {
      return {path: path + '/index.js', external: true}
    })
  }
}

const ExtensionPlugin: Plugin = {
  name: 'extension',
  setup(build) {
    build.initialOptions.bundle = true
    const outExtension = build.initialOptions.outExtension?.['.js'] || '.js'
    build.onResolve({filter: /.*/}, ({kind, path}) => {
      if (kind === 'entry-point') return
      if (path.startsWith('react-icons'))
        return {path: path + '/index.js', external: true}
      const isLocal =
        path.startsWith('./') ||
        path.startsWith('../') ||
        (path.startsWith('@alinea') && path.split('/').length > 2)
      const hasOutExtension = path.endsWith(outExtension)
      const hasExtension = path.split('/').pop()?.includes('.')
      if (isLocal && hasExtension && !hasOutExtension) return
      if (hasOutExtension || !isLocal) return {path, external: true}
      return {path: path + outExtension, external: true}
    })
  }
}

const globalCss = []
const BundleCSSPlugin: Plugin = {
  name: 'BundleCSSPlugin',
  setup(build) {
    const {
      outfile,
      outdir = path.dirname(outfile),
      absWorkingDir = process.cwd()
    } = build.initialOptions
    const outputDir = path.isAbsolute(outdir)
      ? outdir
      : path.join(absWorkingDir, outdir)
    build.initialOptions.metafile = true
    build.onEnd(async res => {
      const meta = res.metafile!
      const files = Object.entries(meta.outputs).filter(entry =>
        entry[0].endsWith('.css')
      )
      if (files.length === 0) return
      const contents = Buffer.concat(
        await Promise.all(
          files.map(entry => {
            return fs.readFile(path.join(absWorkingDir, entry[0]))
          })
        )
      )
      globalCss.push(contents)
      await fs.writeFile(path.join(outputDir, 'index.css'), contents)
    })
  }
}

const buildOptions: BuildOptions = {
  format: 'esm',
  sourcemap: true,
  plugins: [
    StaticPlugin,
    ReactPlugin,
    SassPlugin.configure({
      moduleOptions: {
        localsConvention: 'dashes',
        generateScopedName: 'alinea__[name]-[local]'
      }
    })
  ],
  loader: {
    '.woff': 'file',
    '.woff2': 'file'
  }
}

const builder = BuildTask.configure({
  exclude: ['@alinea/stories', '@alinea/website', '@alinea/css'],
  buildOptions: {
    ...buildOptions,
    plugins: [...buildOptions.plugins, BundleCSSPlugin, ExtensionPlugin]
  }
})
export const buildTask = {
  ...builder,
  async action(options) {
    await builder.action(options)
    await fs.writeFile('packages/css/index.css', Buffer.concat(globalCss))
  }
}

/*
These should be resolved using the conditional exports, but before building
those are not available so we point at the source directly.
*/
const internal = Object.fromEntries(
  getWorkspaces(process.cwd())
    .filter(pkg => {
      return fs.existsSync(`${pkg}/src/index.ts`)
    })
    .map(pkg => {
      const {name} = getManifest(pkg)
      return [name, path.resolve(`${pkg}/src/index.ts`)]
    })
)
const packages = fs.readdirSync('packages/input')
const aliases = Object.fromEntries(
  packages.map(pkg => {
    return [
      `@alinea/input.${pkg}`,
      path.resolve(`packages/input/${pkg}/src/view.ts`)
    ]
  })
)

const devOptions: BuildOptions = {
  ...buildOptions,
  watch: true,
  splitting: true,
  entryPoints: ['packages/stories/src/client.tsx'],
  bundle: true,
  treeShaking: true,
  outdir: 'packages/stories/dist',
  plugins: [
    ...buildOptions.plugins,
    AliasPlugin.configure({
      ...internal,
      ...aliases
    }),
    ReporterPlugin.configure({name: 'Client'}),
    ReloadPlugin
  ],
  define: {
    'process.env.NODE_ENV': '"development"',
    'process.env.__NEXT_TRAILING_SLASH': String(true),
    'process.env.__NEXT_I18N_SUPPORT': String(false),
    'process.env.__NEXT_ROUTER_BASEPATH': '""',
    'process.env.__NEXT_SCROLL_RESTORATION': String(true),
    'process.env.__NEXT_HAS_REWRITES': String(false),
    'process.env.__NEXT_OPTIMIZE_CSS': String(false),
    'process.env.__NEXT_CROSS_ORIGIN': '""',
    'process.env.__NEXT_STRICT_MODE': String(false),
    'process.env.__NEXT_IMAGE_OPTS': String(null),
    __dirname: '""'
  }
}

const modules = findNodeModules(process.cwd())

const serverOptions: BuildOptions = {
  ...buildOptions,
  watch: true,
  platform: 'node',
  entryPoints: ['packages/stories/src/server.ts'],
  bundle: true,
  outdir: 'packages/stories/dist',
  external: modules.filter(m => !m.includes('@alinea')),
  plugins: [
    ...buildOptions.plugins,
    ReporterPlugin.configure({name: 'Server'}),
    RunPlugin.configure({cmd: 'node dist/server.js', cwd: 'packages/stories'}),
    AliasPlugin.configure(internal),
    FixReactIconsPlugin
  ]
}

export const dev = {
  action: () => Promise.all([build(devOptions), build(serverOptions)])
}

export const clean = {
  action() {
    for (const location of getWorkspaces(process.cwd())) {
      fs.removeSync(`${location}/dist`)
    }
  }
}

export const testTask = TestTask.configure({
  buildOptions: {
    ...buildOptions,
    sourcemap: true,
    external: modules.filter(m => !m.includes('@alinea')),
    plugins: [
      ...buildOptions.plugins,
      AliasPlugin.configure(internal),
      FixReactIconsPlugin
    ]
  }
})

export const mkid = {
  action() {
    console.log(createId())
  }
}
