import {AliasPlugin} from '@esbx/alias'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {SassPlugin} from '@esbx/sass'
import {StaticPlugin} from '@esbx/static'
import {findNodeModules} from '@esbx/util'
import {getManifest, getWorkspaces, TestTask} from '@esbx/workspaces'
import autoprefixer from 'autoprefixer'
import type {BuildOptions, Plugin} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import path from 'path'
import pxToRem from 'postcss-pxtorem'
import {BuildTask} from './.esbx/build'
import {createId} from './packages/core/src/Id'

export {VersionTask} from '@esbx/workspaces'

const ExtensionPlugin: Plugin = {
  name: 'extension',
  setup(build) {
    build.initialOptions.bundle = true
    const info = new Map()
    const outExtension = build.initialOptions.outExtension?.['.js'] || '.js'
    function workspaceInfo(workspace: string) {
      if (!info.has(workspace)) {
        const manifest = getManifest(workspace)
        function getDeps(from: Record<string, string> | undefined) {
          return from ? Object.keys(from) : []
        }
        const dependencies = new Set(
          getDeps(manifest.dependencies)
            .concat(getDeps(manifest.peerDependencies))
            .concat(getDeps(manifest.optionalDependencies))
        )
        info.set(workspace, {
          name: manifest.name,
          dependencies,
          seen: new Set()
        })
      }
      return info.get(workspace)!
    }
    build.onResolve({filter: /.*/}, args => {
      if (args.kind === 'entry-point') return
      const isLocal =
        args.path.startsWith('./') ||
        args.path.startsWith('../') ||
        (args.path.startsWith('@alinea') && args.path.split('/').length > 2)
      const hasOutExtension = args.path.endsWith(outExtension)
      const hasExtension = args.path.split('/').pop()?.includes('.')
      if (!args.path.startsWith('.')) {
        const segments = args.path.split('/')
        const pkg = args.path.startsWith('@')
          ? `${segments[0]}/${segments[1]}`
          : segments[0]

        // From which package are we requesting this path?
        if (args.resolveDir.includes('packages')) {
          const paths = args.resolveDir.split(path.sep)
          const workspace = path.join(
            ...paths.slice(0, paths.lastIndexOf('src'))
          )
          const {name, seen, dependencies} = workspaceInfo(workspace)
          if (
            !pkg.startsWith('node:') &&
            !dependencies.has(pkg) &&
            !seen.has(pkg)
          ) {
            console.info(`warning: ${pkg} is not a dependency of ${name}`)
          }
          seen.add(pkg)
        }
      }
      if (isLocal && hasExtension && !hasOutExtension) return
      if (hasOutExtension || !isLocal) return {path: args.path, external: true}
      return {path: args.path + outExtension, external: true}
    })

    build.onEnd(() => {
      const knownWarnings = new Set([
        '@alinea/css', // As a convenience
        '@alinea/client', // In generated code
        '@alinea/sqlite-wasm', // In generated code
        'nodemailer' // Using types
      ])
      for (const {name, seen, dependencies} of info.values()) {
        const unused = [...dependencies].filter(x => !seen.has(x))
        for (const pkg of unused) {
          if (!knownWarnings.has(pkg))
            console.info(
              `info: ${pkg} is defined in dependencies, but appears unused in ${name}`
            )
        }
      }
    })
  }
}

const globalCss: Map<string, Buffer> = new Map()

const BundleCSSPlugin: Plugin = {
  name: 'BundleCSSPlugin',
  setup(build) {
    const {
      outfile,
      outdir = path.dirname(outfile!),
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
      globalCss.set(outputDir, contents)
      await fs.writeFile(path.join(outputDir, 'index.css'), contents)
    })
  }
}

export const sassPlugin = SassPlugin.configure({
  postCssPlugins: [
    pxToRem({
      propList: ['*'],
      minPixelValue: 2
    }),
    autoprefixer()
  ],
  moduleOptions: {
    localsConvention: 'dashes',
    generateScopedName: 'alinea__[name]-[local]'
  }
})

const buildOptions: BuildOptions = {
  format: 'esm',
  sourcemap: true,
  plugins: [EvalPlugin, StaticPlugin, ReactPlugin, sassPlugin],
  loader: {
    '.woff': 'file',
    '.woff2': 'file',
    '.json': 'json'
  }
}

const builder = BuildTask.configure({
  exclude: ['@alinea/website', '@alinea/css'],
  buildOptions: {
    ...buildOptions,
    plugins: [...buildOptions.plugins!, BundleCSSPlugin, ExtensionPlugin]
  }
})

function writeCss() {
  return fs.writeFile(
    'packages/css/src/generated.css',
    Buffer.concat([...globalCss.values()])
  )
}

export const buildTask = {
  ...builder,
  async action(options: any) {
    const skipTypes =
      'skip-types' in options ? options['skip-types'] : fs.existsSync('dist')
    await builder.action({
      ...options,
      'skip-types': skipTypes,
      watch: options.watch && {
        onRebuild() {
          writeCss()
        }
      }
    })
    await writeCss()
  }
}

export const prepare = {
  async action() {
    if (!fs.existsSync('dist')) await buildTask.action({})
  }
}

export const InternalPackages: Plugin = {
  name: 'InternalPackages',
  setup(build) {
    const paths = Object.fromEntries(
      getWorkspaces(process.cwd()).map(location => {
        const meta = getManifest(location)
        return [meta.name, location]
      })
    )
    build.onResolve({filter: /@alinea\/.*/}, async args => {
      const segments = args.path.split('/')
      const pkg = segments.slice(0, 2).join('/')
      const location = paths[pkg]
      if (!location) return
      const loc = ['.', location, 'src', ...segments.slice(2)].join('/')
      return await build.resolve(loc, {resolveDir: process.cwd()})
    })
  }
}

/*
These should be resolved using the conditional exports, but before building
those are not available so we point at the source directly.
*/
export const InternalViews: Plugin = {
  name: 'InternalViews',
  setup(build) {
    const packages = fs.readdirSync('packages/input')
    const aliases = Object.fromEntries(
      packages.map(pkg => {
        return [
          `@alinea/input.${pkg}`,
          path.resolve(`packages/input/${pkg}/src/view.ts`)
        ]
      })
    )
    AliasPlugin.configure(aliases).setup(build)
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
  external: modules
    // .filter(m => !m.includes('@alinea'))
    .filter(m => !m.includes('shiki'))
    .concat('@alinea/sqlite-wasm'),
  plugins: [
    ...buildOptions.plugins!,
    ReporterPlugin.configure({name: 'Server'}),
    RunPlugin.configure({
      cmd: 'node --experimental-specifier-resolution=node dist/dev.mjs'
    })
    // InternalPackages
  ]
}

export const dev = {
  async action() {
    await buildTask.action({watch: true})
    return build(serverOptions)
  }
}

export const clean = {
  action() {
    fs.removeSync('dist')
    fs.removeSync('packages/website/.alinea')
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
    plugins: [...buildOptions.plugins!, InternalPackages, FixReactIconsPlugin]
  }
})

export const mkid = {
  action() {
    console.log(createId())
  }
}
