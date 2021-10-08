import spawn from 'cross-spawn-promise'
import {build, Plugin} from 'esbuild'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import rmfr from 'rmfr'
import {ScssModulesPlugin} from './scss-modules'

let skipTypes = false
let which = []
const packages = glob.sync('packages/**/package.json')
const root = process.cwd()
const tsc = root + '/node_modules/.bin/tsc'

const bundle = new Set(['.scss'])
const exclude = ['website']
for (const arg of process.argv.slice(2)) {
  if (arg === '--skip-types') skipTypes = true
  else which.push(arg)
}

const externalPlugin: Plugin = {
  name: 'external-plugin',
  setup(build) {
    build.onResolve({filter: /.*/}, args => {
      // Todo: here we can easily check which dependencies we're using and
      // whether they were declared in the package manifest. If not
      // display a warning so the manifest can be updated.
      const extension = path.extname(args.path)
      if (bundle.has(extension)) return
      if (args.kind === 'entry-point') return
      // Help nodejs find files by appending the extension, see evanw/esbuild#622
      const length = args.path.split('/').length
      const isSub = args.path.startsWith('@') ? length > 2 : length > 1
      const isRelative =
        args.path.startsWith('.') ||
        (isSub && path.extname(args.path) !== '.js')
      // https://stackoverflow.com/questions/64453859/directory-import-is-not-supported-resolving-es-modules-with-node-js
      const isDirImport = /^@alinea\/[^\/]*$/.test(args.path)
      const modulePath = isRelative
        ? args.path + '.js'
        : isDirImport
        ? args.path + '/index.js'
        : args.path
      return {path: modulePath, external: true}
    })
  }
}

let globalCss = ''

async function buildPackage(pkg: string) {
  const location = pkg.substr(0, pkg.length - '/package.json'.length)
  const meta = JSON.parse(await fs.promises.readFile(pkg, 'utf8'))
  console.log(`> ${location}`)
  const cwd = path.join(root, location)
  if (!skipTypes) {
    await rmfr(path.join(cwd, 'dist'))

    try {
      const tsconfig = path.join(location, 'tsconfig.json')
      // Before building we update the main tsconfig by changing the paths to
      // point to the node_modules location. If we don't typescript generates
      // declarations for each of the symlinked packages. We don't do this by default
      // because it makes vscode autocomplete end up in the symlinks and it gets
      // very confusing.
      if (fs.existsSync(tsconfig)) {
        const config = fs.readFileSync(tsconfig, 'utf-8')
        fs.writeFileSync(
          tsconfig,
          config.replace('tsconfig.json', 'tsconfig.build.json')
        )
        await spawn(tsc, [], {
          stdio: 'inherit',
          cwd
        })
        fs.writeFileSync(
          tsconfig,
          config.replace('tsconfig.build.json', 'tsconfig.json')
        )
      }
    } catch (error) {
      if (error?.stderr) console.error((error as any).stderr.toString())
      else console.error(error)
      process.exit(1)
    }
  }
  const entryPoints = glob.sync('src/**/*.{ts,tsx}', {cwd})
  for (const entryPoint of entryPoints) {
    const inject = entryPoint.endsWith('.tsx')
      ? [root + '/scripts/react-shim.js']
      : undefined
    const sub = path.dirname(entryPoint).substr('src/'.length)
    await build({
      absWorkingDir: cwd,
      format: 'esm',
      bundle: true,
      sourcemap: true,
      entryPoints: [entryPoint],
      outdir: path.join('dist', sub),
      inject,
      plugins: [
        externalPlugin,
        ScssModulesPlugin({
          cache: false,
          localsConvention: 'dashes',
          generateScopedName: 'alinea__[name]-[local]'
        })
      ]
    })
  }
  const cssFiles = glob.sync('dist/**/*.css', {cwd})
  let cssBundle = ''
  for (const cssFile of cssFiles) {
    cssBundle +=
      (await fs.promises.readFile(path.join(cwd, cssFile), 'utf-8')) + '\n'
  }
  if (cssBundle) {
    await fs.promises.writeFile(path.join(cwd, 'dist/index.css'), cssBundle)
    globalCss += cssBundle
  }
}

const sync = true

async function main() {
  const builds = packages.map(pkg => {
    return async () => {
      const isExternal = pkg.includes('node_modules')
      const isSelected =
        which.length > 0 ? which.some(w => pkg.includes(w)) : true
      const isExcluded = exclude.some(ex => pkg.includes(ex))
      const needsBuilding = !isExternal && isSelected && !isExcluded
      if (needsBuilding) await buildPackage(pkg)
    }
  })
  if (sync) {
    for (const build of builds) await build()
  } else {
    await Promise.all(builds.map(build => build()))
  }
  if (which.length === 0) {
    await fs.promises.writeFile('packages/css/index.css', globalCss)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
