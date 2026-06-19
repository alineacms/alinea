import {ReporterPlugin} from '@esbx/reporter'
import {dequal} from 'dequal'
import esbuild, {
  type BuildContext,
  type BuildOptions,
  type Plugin
} from 'esbuild'
import fsExtra from 'fs-extra'
import glob from 'glob'
import {
  transform,
  type CSSModuleExport,
  type CSSModuleExports,
  type CSSModuleReference
} from 'lightningcss'
import {spawn} from 'node:child_process'
import fs from 'node:fs'
import {builtinModules} from 'node:module'
import path from 'node:path'
import prettyBytes from 'pretty-bytes'
import sade from 'sade'
import {sync} from 'symlink-dir'

sync('.', 'node_modules/alinea')

const BROWSER_TARGET = 'browser'
const SERVER_TARGET = 'server'
const CSS_ENTRY = 'css-entry'
const JS_ENTRY = 'js-entry'

const llmsHandbookUrl = 'https://alineacms.com/llms-full.txt'
const llmsHandbookFile = 'llms-full.txt'

const external = builtinModules
  .concat(builtinModules.map(m => `node:${m}`))
  .concat([
    'fs-extra',
    '@alinea/generated',
    '@alinea/iso',
    '@alinea/sqlite-wasm',
    'next',
    'sharp',
    'react',
    'react-dom',
    'esbuild'
  ])

function dirsOf(source: string) {
  const contents = fs.readdirSync(source, {withFileTypes: true})
  return contents
    .filter(dirent => dirent.isDirectory())
    .flatMap((dirent): Array<string> => {
      const wd = path.join(source, dirent.name)
      return [wd, ...dirsOf(wd)]
    })
}

function rewriteDeclarationImports(contents: string): string {
  return contents
    .replace(/(["'])#\/index\.js\1/g, (_match, quote) => {
      return `${quote}alinea${quote}`
    })
    .replace(/(["'])#\/(.*?)\.js\1/g, (_match, quote, specifier) => {
      return `${quote}alinea/${specifier}${quote}`
    })
}

const cjsModules: Plugin = {
  name: 'cjs-modules',
  setup(build) {
    build.onEnd(async () => {
      await esbuild.build({
        bundle: true,
        format: 'cjs',
        platform: 'node',
        entryPoints: ['./src/adapter/next/with-alinea.ts'],
        outfile: './dist/next.cjs',
        external: ['alinea', 'next']
      })
    })
  }
}

const bundleTs: Plugin = {
  name: 'bundle-ts',
  setup(build) {
    build.onEnd(() => {
      const root = './dist'
      const entries = glob.sync('**/*.d.ts', {cwd: root})
      let declaration = ''
      for (const entry of entries) {
        if (entry.startsWith('bundled')) continue
        if (entry.includes('/static/')) continue
        const location = entry.slice(0, -'.d.ts'.length)
        const absolute = location === 'index' ? 'alinea' : `alinea/${location}`
        let contents = fs.readFileSync(path.join(root, entry), 'utf-8')
        contents = rewriteDeclarationImports(contents)
        fs.writeFileSync(path.join(root, entry), contents)
        // Strip shebang
        if (contents.startsWith('#!')) {
          contents = contents.slice(contents.indexOf('\n') + 1)
        }
        contents = contents.replace(
          /(from|import) '(\.\.?\/.*?)'/g,
          (match, p1, p2) => {
            const relative = path
              .join('alinea', path.dirname(location), p2)
              .replaceAll('\\', '/')
              .replace(/\.js$/, '')
            return `${p1} '${relative}'`
          }
        )
        contents = contents.replace(
          /import\("(\.\.?\/.*?)"\)/g,
          (match, p1) => {
            const relative = path
              .join('alinea', path.dirname(location), p1)
              .replaceAll('\\', '/')
              .replace(/\.js$/, '')
            return `import("${relative}")`
          }
        )
        contents = contents.replace(/import\("(.*?).js"\)/g, (match, p1) => {
          return `import("${p1}")`
        })
        contents = contents.replace(
          /'#view\/(.*?)\.view\.js'/g,
          (match, p1) => {
            return `'alinea/${p1}'`
          }
        )
        // Remove declare keyword
        contents = contents.replace(/declare /g, '')
        declaration += `declare module '${absolute}' {\n\n  ${contents.replace(
          /\n/g,
          '\n  '
        )}\n}\n\n`
      }
      fs.writeFileSync('./dist/bundled.d.ts', declaration)
    })
  }
}

const checkCycles = process.env.CHECK_CYCLES

const internalPlugin: Plugin = {
  name: 'internal',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
    build.onResolve({filter: /^alinea.*/}, args => {
      if (checkCycles) {
        // Make this a relative path
        const file =
          args.path === 'alinea' ? 'index' : args.path.slice('alinea/'.length)
        const localFile = path.join(src, file)
        const target =
          checkCycles === 'browser' ? BROWSER_TARGET : SERVER_TARGET
        const targetFile = `${localFile}.${target}`
        const hasTargetFile =
          fs.existsSync(`${targetFile}.tsx`) ||
          fs.existsSync(`${targetFile}.ts`)
        const relative = hasTargetFile
          ? `./${path.relative(args.resolveDir, targetFile)}.js`
          : `./${path.relative(args.resolveDir, localFile)}.js`
        return {path: relative, external: true}
      }
      if (args.path.endsWith('.js'))
        throw new Error(
          `Remove file extension on absolute import: ${args.path} in ${args.importer}`
        )
      return {path: args.path, external: true}
    })
  }
}

const cssModulesJsPlugin: Plugin = {
  name: 'js-css-modules',
  setup(build) {
    build.onLoad({filter: /\.module\.css$/}, args => {
      const {json, watchFiles} = processCssModule(args.path)
      return {contents: json, loader: 'js', watchFiles}
    })
  }
}

const cssModulesPlugin: Plugin = {
  name: 'css-modules',
  setup(build) {
    build.onLoad({filter: /\.module\.css$/}, args => {
      const {css, watchFiles} = processCssModule(args.path)
      return {contents: css, loader: 'css', watchFiles}
    })
  }
}

const oauthIsoCrypto: Plugin = {
  name: 'oauth-iso-crypto',
  setup(build) {
    const namespace = 'oauth-iso-crypto'
    build.onResolve({filter: /^node:crypto$|^crypto$/}, args => {
      if (!args.importer.includes('/@badgateway/oauth2-client/')) return
      return {path: args.path, namespace}
    })
    build.onLoad({filter: /.*/, namespace}, () => {
      return {
        contents: [
          `import {crypto} from '@alinea/iso'`,
          `export {crypto}`,
          `export const webcrypto = crypto`,
          `export default {webcrypto}`
        ].join('\n'),
        loader: 'js'
      }
    })
  }
}

const cleanup: Plugin = {
  name: 'cleanup',
  setup(build) {
    build.initialOptions.metafile = true
    let prevOutputs: Set<string>
    build.onEnd(result => {
      if (!result.metafile) return
      const outputs = new Set(Object.keys(result.metafile.outputs))
      if (prevOutputs) {
        for (const file of prevOutputs)
          if (!outputs.has(file)) fsExtra.removeSync(file)
      }
      prevOutputs = outputs
    })
  }
}

const cssEntry: Plugin = {
  name: CSS_ENTRY,
  setup(build) {
    build.onResolve({filter: new RegExp(`^${CSS_ENTRY}$`)}, args => ({
      path: args.path,
      namespace: CSS_ENTRY
    }))
    build.onLoad(
      {filter: new RegExp(`^${CSS_ENTRY}$`), namespace: CSS_ENTRY},
      args => {
        const files = glob.sync('src/**/*.css')
        const entryPoint = [`@import url('./src/dashboard/global.css');`]
          .concat(files.map(file => `@import url('./${file}');`))
          .join('\n')
        return {
          contents: entryPoint,
          loader: 'css',
          watchFiles: files,
          watchDirs: dirsOf('src'),
          resolveDir: '.'
        }
      }
    )
  }
}

const externalize: Plugin = {
  name: 'externalize',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
    let modules: Set<string>
    build.onStart(() => {
      modules = new Set()
    })
    build.onResolve({filter: /^(\.|#)/}, args => {
      if (args.kind === 'entry-point') return
      if (
        args.path.endsWith('.json') ||
        args.path.endsWith('.css') ||
        args.path.endsWith('.woff2')
      )
        return
      if (!args.resolveDir.startsWith(src)) {
        if (args.resolveDir.includes('node_modules')) {
          const folder = args.resolveDir
            .replaceAll('\\', '/')
            .split('node_modules/')[1]
          const segments = folder.split('/')
          const module = folder.startsWith('@')
            ? segments.slice(0, 2)
            : segments.slice(0, 1)
          modules.add(module.join('/'))
        }
        return
      }
      if (args.path.endsWith('.cjs')) return
      if (!args.path.endsWith('.js') && !args.path.endsWith('.mjs')) {
        console.error(`Missing file extension on local import: ${args.path}`)
        console.error(`In file: ${args.importer}`)
        process.exit(1)
      }
      if (args.path.startsWith('#')) {
        const withoutExtension = args.path.slice(0, args.path.lastIndexOf('.'))
        return {path: withoutExtension.replace('#/', 'alinea/'), external: true}
      }
      return {path: args.path, external: true}
    })
    build.onEnd(() => {
      let licenses = ''
      for (const module of modules) {
        const target = path.join(cwd, 'node_modules', module)
        const pkg = JSON.parse(
          fs.readFileSync(path.join(target, 'package.json'), 'utf-8')
        )
        let licenseText: string = ''
        try {
          licenseText = fs.readFileSync(path.join(target, 'LICENSE'), 'utf-8')
        } catch {}
        if (!licenseText)
          try {
            licenseText = fs.readFileSync(
              path.join(target, 'LICENSE.md'),
              'utf-8'
            )
          } catch {}
        if (!licenseText) licenseText = pkg.license
        if (!licenseText) console.warn(`Missing license for module ${module}`)
        else
          licenses += `\n\n===\n\n# ${module}@${pkg.version} (${pkg.license})\n\n${licenseText}`
      }
      fs.writeFileSync(
        path.join(cwd, build.initialOptions.outdir!, 'LICENSES.md'),
        `This file contains the licenses of the bundled modules in this distribution.${licenses}`
      )
    })
  }
}

function jsEntry({
  watch,
  test,
  report
}: {
  watch: boolean
  test: boolean
  report: boolean
}): Plugin {
  const plugins = [
    cssModulesJsPlugin,
    internalPlugin,
    externalize,
    oauthIsoCrypto,
    cleanup
  ]
  if (report) plugins.push(reportSizePlugin)
  return {
    name: JS_ENTRY,
    setup(build) {
      let context: BuildContext
      let currentFiles: Array<string> = []
      build.onResolve({filter: new RegExp(`^${JS_ENTRY}$`)}, args => ({
        path: args.path,
        namespace: JS_ENTRY
      }))
      build.onLoad(
        {filter: new RegExp(`^${JS_ENTRY}$`), namespace: JS_ENTRY},
        async args => {
          const staticFolders = glob.sync('src/**/static')
          for (const folder of staticFolders) {
            const target = folder.replace('src/', 'dist/')
            fsExtra.copySync(folder, target)
          }
          const files = glob.sync('src/**/*.{ts,tsx}').filter(file => {
            if (file.endsWith('UIStory.tsx')) return false
            if (!test && file.endsWith('.test.ts')) return false
            if (!test && file.endsWith('.spec.tsx')) return false
            if (!test && file.endsWith('.story.tsx')) return false
            if (!test && file.endsWith('.test.tsx')) return false
            return !file.endsWith('.d.ts') && !file.endsWith('.stories.tsx')
          })
          if (!context || !dequal(currentFiles, files)) {
            context = await esbuild.context({
              plugins,
              format: 'esm',
              entryPoints: files,
              outdir: 'dist',
              bundle: true,
              splitting: true,
              treeShaking: true,
              external,
              chunkNames: 'chunks/[name]-[hash]',
              platform: 'neutral',
              mainFields: ['module', 'main'],
              jsx: 'automatic',
              alias: {
                yjs: `./src/yjs.ts`,
                // Mistakenly imported because it is used in the JSDocs
                'y-protocols/awareness': `data:text/javascript,
                  export const Awareness = undefined
                `,

                // Used in lib0, polyfill crypto for nodejs
                'lib0/webcrypto': `data:text/javascript,
                  import {crypto} from '@alinea/iso'
                  export const subtle = crypto.subtle
                  export const getRandomValues = crypto.getRandomValues.bind(crypto)`,

                'use-sync-external-store': `data:text/javascript,
                  export const useSyncExternalStore = () => {
                    throw new Error('useSyncExternalStore is not supported in this environment')
                  }
                //`
              },
              define: {
                // See https://github.com/pmndrs/jotai/blob/2188d7557500e59c10415a9e74bb5cfc8a3f9c31/src/react/useSetAtom.ts#L33
                'import.meta.env.MODE': '"production"'
              },
              loader: {
                '.woff2': 'file'
              }
            })
            currentFiles = files
          }
          const result = await context.rebuild().catch(() => {})
          if (!watch) context.dispose()
          return {
            contents: '',
            resolveDir: '.',
            watchDirs: staticFolders,
            watchFiles: result?.metafile
              ? Object.keys(result.metafile.inputs)
              : files
          }
        }
      )
    }
  }
}

interface ProcessCssModuleResult {
  css: string
  watchFiles: string[]
  json?: string
}

function processCssModule(file: string): ProcessCssModuleResult {
  const result = transform({
    filename: file,
    code: fs.readFileSync(file),
    cssModules: {
      pattern: 'alinea-[local]'
    }
  })
  const classes = cssModuleClasses(result.exports || {})
  return {
    css: Buffer.from(result.code).toString(),
    watchFiles: [file],
    json: `export default ${JSON.stringify(classes, null, 2)}`
  }
}

function cssModuleClasses(exports: CSSModuleExports): Record<string, string> {
  const classes: Record<string, string> = {}
  for (const [name, value] of Object.entries(exports)) {
    const className = cssModuleClassName(value)
    classes[name] = className
    const dashedName = name.replace(
      /-+([a-zA-Z0-9])/g,
      (_match: string, character: string) => character.toUpperCase()
    )
    classes[dashedName] = className
  }
  return classes
}

function cssModuleClassName(cssModule: CSSModuleExport): string {
  return [cssModule.name]
    .concat(cssModule.composes.flatMap(cssModuleReferenceNames))
    .join(' ')
}

function cssModuleReferenceNames(reference: CSSModuleReference): Array<string> {
  if (reference.type === 'dependency') return []
  return [reference.name]
}

function forwardCmd() {
  const argv = process.argv
  const separator = argv.findIndex(arg => arg === '--')
  if (separator === -1) return
  const command = argv.slice(separator + 1)
  if (command.length === 0) return
  return command.join(' ')
}

const runPlugin: Plugin = {
  name: 'run',
  setup(build) {
    let isStarted = false
    build.onEnd(res => {
      if (isStarted) return
      if (res.errors.length > 0) return
      const cmd = forwardCmd()
      if (!cmd) return
      spawn(cmd, {
        stdio: 'inherit',
        shell: true
      })
      isStarted = true
    })
  }
}

const reportSizePlugin: Plugin = {
  name: 'report-size',
  setup(build) {
    build.initialOptions.minify = true
    build.onEnd(async result => {
      if (result.errors.length > 0) return
      const common = {
        format: 'esm',
        write: false,
        bundle: true,
        minify: true,
        metafile: true,
        logOverride: {
          'ignored-bare-import': 'silent'
        },
        external
      } satisfies BuildOptions
      const server = await build.esbuild.build({
        ...common,
        platform: 'node',
        entryPoints: {server: 'dist/index.js'},
        tsconfigRaw: {}
      })
      console.info(
        `Server output: ` +
          prettyBytes(server.metafile.outputs['server.js'].bytes)
      )
      const dashboard = await build.esbuild.build({
        ...common,
        platform: 'browser',
        entryPoints: {dashboard: 'dist/dashboard/App.js'},
        tsconfigRaw: {}
      })
      console.info(
        `Dashboard output: ` +
          prettyBytes(dashboard.metafile.outputs['dashboard.js'].bytes)
      )
    })
  }
}

async function build({
  watch,
  test,
  report
}: {
  watch: boolean
  test: boolean
  report: boolean
}): Promise<void> {
  if (!watch && !fs.existsSync(llmsHandbookFile)) {
    const response = await fetch(llmsHandbookUrl)
    if (!response.ok) {
      throw new Error(
        `Failed to refresh ${llmsHandbookFile}: ` +
          `${response.status} ${response.statusText}`
      )
    }
    const handbook = await response.text()
    fs.writeFileSync(llmsHandbookFile, handbook)
    console.info(`Refreshed ${llmsHandbookFile} from ${llmsHandbookUrl}`)
  }
  const plugins = [
    cssEntry,
    cssModulesPlugin,
    cleanup,
    jsEntry({watch, test, report}),
    bundleTs,
    ReporterPlugin.configure({name: 'alinea'}),
    runPlugin,
    cjsModules
  ]
  const context = await esbuild.context({
    bundle: true,
    entryPoints: [
      {in: CSS_ENTRY, out: 'index'},
      {in: JS_ENTRY, out: 'dummy'}
    ],
    outdir: 'dist',
    loader: {
      '.woff2': 'file'
    },
    sourcemap: Boolean(watch),
    plugins
  })

  return watch
    ? context.watch()
    : context.rebuild().then(() => context.dispose())
}

sade('build', true)
  .option('--report', `Report build stats`)
  .option('--watch', `Watch for changes`)
  .action(async opts => {
    await build(opts)
  })
  .parse(process.argv)
