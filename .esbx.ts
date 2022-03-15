import {AliasPlugin} from '@esbx/alias'
import {ReactPlugin} from '@esbx/react'
import {ReloadPlugin} from '@esbx/reload'
import {ReporterPlugin} from '@esbx/reporter'
import {RunPlugin} from '@esbx/run'
import {SassPlugin} from '@esbx/sass'
import {StaticPlugin} from '@esbx/static'
import {findNodeModules} from '@esbx/util'
import {BuildTask, getManifest, getWorkspaces, TestTask} from '@esbx/workspaces'
import autoprefixer from 'autoprefixer'
import {execSync} from 'child_process'
import crypto from 'crypto'
import type {BuildOptions, Plugin} from 'esbuild'
import {build} from 'esbuild'
import fs from 'fs-extra'
import path from 'path'
import pxToRem from 'postcss-pxtorem'
import {createId} from './packages/core/src/Id'

const FixReactIconsPlugin: Plugin = {
  name: 'FixReactIconsPlugin',
  setup(build) {
    build.onResolve({filter: /react-icons.*/}, ({path}) => {
      if (!path.endsWith('index.js'))
        return {path: path + '/index.js', external: true}
    })
  }
}

const WasmPlugin: Plugin = {
  name: 'WasmPlugin',
  setup(build) {
    build.onResolve({filter: /\.wasm$/}, args => {
      if (args.namespace === 'wasm-stub') {
        return {
          path: args.path,
          namespace: 'wasm-binary'
        }
      }

      if (args.resolveDir === '') {
        return
      }
      return {
        path: path.isAbsolute(args.path)
          ? args.path
          : path.join(args.resolveDir, args.path),
        namespace: 'wasm-stub'
      }
    })

    build.onLoad({filter: /.*/, namespace: 'wasm-stub'}, async args => ({
      contents: `import wasm from ${JSON.stringify(args.path)}
        export default (imports) =>
          WebAssembly.instantiate(wasm, imports).then(
            result => result.instance.exports)`
    }))

    build.onLoad({filter: /.*/, namespace: 'wasm-binary'}, async args => ({
      contents: await fs.promises.readFile(args.path),
      loader: 'binary'
    }))
  }
}

const ExtensionPlugin: Plugin = {
  name: 'extension',
  setup(build) {
    build.initialOptions.bundle = true
    const outExtension = build.initialOptions.outExtension?.['.js'] || '.js'
    build.onResolve({filter: /.*/}, ({kind, path}) => {
      if (kind === 'entry-point') return
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
  ],
  loader: {
    '.woff': 'file',
    '.woff2': 'file'
  }
}

const AnalyzePlugin: Plugin = {
  name: 'AnalyzePlugin',
  setup(build) {
    build.initialOptions.metafile = true
    build.onEnd(async res => {
      let text = await build.esbuild.analyzeMetafile(res.metafile, {
        verbose: true
      })
      console.log(text)
    })
  }
}

const builder = BuildTask.configure({
  exclude: ['@alinea/stories', '@alinea/website', '@alinea/css'],
  buildOptions: {
    ...buildOptions,
    plugins: [
      ...buildOptions.plugins,
      BundleCSSPlugin,
      FixReactIconsPlugin,
      ExtensionPlugin
    ]
  }
})

export const buildTask = {
  ...builder,
  async action(options) {
    await builder.action(options)
    await fs.writeFile('packages/css/src/index.css', Buffer.concat(globalCss))
  }
}

const InternalPackages: Plugin = {
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

let generating

async function generate() {
  const outfile = path.posix.join(
    process.cwd(),
    'node_modules',
    crypto.randomBytes(16).toString('hex') + '.mjs'
  )
  const cwd = path.resolve('packages/website')
  await buildTask.action({'skip-types': fs.existsSync('.types')})
  await build({
    bundle: true,
    format: 'esm',
    platform: 'node',
    ...buildOptions,
    outfile,
    external: modules.filter(
      m => !m.includes('@alinea') || m.includes('@alinea/sqlite-wasm')
    ),
    plugins: [
      ...buildOptions.plugins,
      InternalPackages,
      FixReactIconsPlugin,
      StaticPlugin.configure({
        sources: [path.resolve('packages/cli/src/index.ts')]
      })
    ],
    stdin: {
      contents: `import {generate} from '@alinea/cli/Generate'
      export default generate({cwd: ${JSON.stringify(cwd)}})`,
      resolveDir: process.cwd(),
      sourcefile: 'gen.js'
    }
  })
  await import(`file://${outfile}`)
    .then(({default: promised}) => promised)
    .finally(() => fs.promises.unlink(outfile))
}

const GeneratePlugin: Plugin = {
  name: 'GeneratePlugin',
  setup(build) {
    return generating || (generating = generate())
  }
}

/*
These should be resolved using the conditional exports, but before building
those are not available so we point at the source directly.
*/
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
  minify: true,
  splitting: true,
  entryPoints: {client: 'packages/stories/src/client.tsx'},
  bundle: true,
  treeShaking: true,
  outdir: 'packages/stories/dist',
  plugins: [
    ...buildOptions.plugins,
    AliasPlugin.configure(aliases),
    AliasPlugin.configure({
      path: path.resolve('node_modules/path-browserify/index.js')
    }),
    InternalPackages,
    ReporterPlugin.configure({name: 'Client'}),
    ReloadPlugin,
    GeneratePlugin
  ],
  external: ['fs'],
  define: {
    'process.env.NODE_ENV': '"production"',
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
    InternalPackages,
    AliasPlugin.configure({
      'next/link': path.resolve('./node_modules/next/link.js')
    }),
    FixReactIconsPlugin,
    GeneratePlugin,
    WasmPlugin
  ],
  banner: {
    // Previewing the next.js website makes us load a bunch of non ESM javascript
    js: "import {createRequire} from 'module';global.require = createRequire(import.meta.url);"
  }
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
    plugins: [...buildOptions.plugins, InternalPackages, FixReactIconsPlugin]
  }
})

export const mkid = {
  action() {
    console.log(createId())
  }
}

export const cli = {
  action: async () => {
    await generate()
    try {
      execSync(
        `node --experimental-specifier-resolution=node ./packages/cli/dist/index.js`,
        {stdio: 'inherit'}
      )
    } catch (e) {
      process.exit(e.status)
    }
  }
}
