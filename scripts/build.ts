import spawn from 'cross-spawn-promise'
import {build, Plugin} from 'esbuild'
import {ScssModulesPlugin} from 'esbuild-scss-modules-plugin'
import fs from 'fs'
import glob from 'glob'
import path from 'path'

const packages = glob.sync('packages/**/package.json')
const root = process.cwd()
const tsc = root + '/node_modules/.bin/tsc'

const bundle = new Set(['.scss', '.css'])

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
  const meta = JSON.parse(fs.readFileSync(pkg, 'utf-8'))
  const needsReact = Boolean(meta.peerDependencies?.react)
  const inject = needsReact ? [root + '/scripts/react-shim.js'] : undefined
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
