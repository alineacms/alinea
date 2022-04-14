import {AliasPlugin} from '@esbx/alias'
import {EvalPlugin} from '@esbx/eval'
import {ReactPlugin} from '@esbx/react'
import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {SassPlugin} from '@esbx/sass'
import {StaticPlugin} from '@esbx/static'
import {findNodeModules} from '@esbx/util'
import {BuildTask, getManifest, getWorkspaces, TestTask} from '@esbx/workspaces'
import autoprefixer from 'autoprefixer'
import type {BuildOptions, Plugin} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import path from 'path'
import pxToRem from 'postcss-pxtorem'
import {createId} from './packages/core/src/Id'

export {VersionTask} from '@esbx/workspaces'

const ExtensionPlugin: Plugin = {
  name: 'extension',
  setup(build) {
    build.initialOptions.bundle = true
    const cwd = build.initialOptions.absWorkingDir
    const info = getManifest(cwd!)
    function getDeps(from: Record<string, string> | undefined) {
      return from ? Object.keys(from) : []
    }
    const dependencies = new Set(
      getDeps(info.dependencies)
        .concat(getDeps(info.peerDependencies))
        .concat(getDeps(info.optionalDependencies))
    )
    const seen = new Set()
    const outExtension = build.initialOptions.outExtension?.['.js'] || '.js'
    build.onResolve({filter: /.*/}, ({kind, path}) => {
      if (kind === 'entry-point') return
      const isLocal =
        path.startsWith('./') ||
        path.startsWith('../') ||
        (path.startsWith('@alinea') && path.split('/').length > 2)
      const hasOutExtension = path.endsWith(outExtension)
      const hasExtension = path.split('/').pop()?.includes('.')
      if (!path.startsWith('.')) {
        const segments = path.split('/')
        const pkg = path.startsWith('@')
          ? `${segments[0]}/${segments[1]}`
          : segments[0]
        if (
          !pkg.startsWith('node:') &&
          pkg !== 'react' &&
          !dependencies.has(pkg) &&
          !seen.has(pkg)
        ) {
          console.info(`warning: ${pkg} is not a dependency of ${info.name}`)
        }
        seen.add(pkg)
      }
      if (isLocal && hasExtension && !hasOutExtension) return
      if (hasOutExtension || !isLocal) return {path, external: true}
      return {path: path + outExtension, external: true}
    })

    build.onEnd(() => {
      const knownWarnings = new Set([
        '@alinea/css', // As a convenience
        '@alinea/sqlite-wasm', // In generated code
        'nodemailer' // Using types
      ])
      const unused = [...dependencies].filter(x => !seen.has(x))
      for (const pkg of unused) {
        if (!knownWarnings.has(pkg))
          console.info(
            `info: ${pkg} is defined in dependencies, but appears unused in ${info.name}`
          )
      }
    })
  }
}

const globalCss: Array<Buffer> = []

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
      globalCss.push(contents)
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
  exclude: ['@alinea/stories', '@alinea/website', '@alinea/css'],
  buildOptions: {
    ...buildOptions,
    plugins: [...buildOptions.plugins!, BundleCSSPlugin, ExtensionPlugin]
  }
})

export const buildTask = {
  ...builder,
  async action(options: any) {
    const skipTypes = fs.existsSync('.types')
    await builder.action({...options, 'skip-types': skipTypes})
    await fs.writeFile(
      'packages/css/src/generated.css',
      Buffer.concat(globalCss)
    )
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
  entryPoints: ['dev.ts'],
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
      cmd: 'node --experimental-specifier-resolution=node dist/dev.js'
    })
    // InternalPackages
  ]
}

export const dev = {
  action: () => build(serverOptions)
}

export const clean = {
  action() {
    fs.removeSync('.types')
    fs.removeSync('dist')
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
