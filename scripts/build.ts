import spawn from 'cross-spawn-promise'
import {build, Plugin} from 'esbuild'
import {ScssModulesPlugin} from 'esbuild-scss-modules-plugin'
import glob from 'glob'
import path from 'path'

const packages = glob.sync('packages/**/package.json')
const root = process.cwd()
const tsc = root + '/node_modules/.bin/tsc'

const bundle = new Set(['.scss', '.css'])

// Todo: before building we should update the main tsconfig by changing the
// paths to point to the node_modules location. If we don't typescript generates
// declarations for each of the symlinked packages. We don't do this by default
// because it makes vscode autocomplete end up in the symlinks and it gets
// very confusing.

// "@alinea/input.*": ["./node_modules/@alinea/input.*/src"],
// "@alinea/core/*": ["./node_modules/@alinea/core/src/*"],
// "@alinea/editor/*": ["./node_modules/@alinea/editor/src/*"],
// "@alinea/ui/*": ["./node_modules/@alinea/ui/src/*"],
// "@alinea/*": ["./node_modules/@alinea/*/src"]

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
      return {external: true}
    })
  }
}

async function buildPackage(pkg: string) {
  const location = pkg.substr(0, pkg.length - '/package.json'.length)
  const cwd = path.join(root, location)
  try {
    await spawn(tsc, [], {stdio: 'inherit', cwd})
  } catch (error) {
    console.error((error as any).stderr.toString())
    process.exit(1)
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
          localsConvention: 'dashes'
        })
      ]
    })
  }
  console.log(`> ${location}`)
}

Promise.all(
  packages.filter(pkg => !pkg.includes('node_modules')).map(buildPackage)
).catch(e => {
  console.error(e)
  process.exit(1)
})
