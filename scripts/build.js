const spawn = require('cross-spawn-promise')
const {build} = require('esbuild')
const glob = require('glob')
const {ScssModulesPlugin} = require('esbuild-scss-modules-plugin')
const path = require('path')

const packages = glob.sync('packages/**/package.json')
const tsc = __dirname + '/../node_modules/.bin/tsc'
const root = process.cwd()
const externalPlugin = {
  name: 'external-plugin',
  setup(build) {
    build.onResolve({filter: /^[^\.](.*?)$/}, args => {
      return {path: args.path, external: true}
    })
  }
}

async function buildPackage(package) {
  const location = package.substr(0, package.length - '/package.json'.length)
  const cwd = path.join(root, location)
  try {
    await spawn(tsc, [], {stdio: 'inherit', cwd})
  } catch (e) {
    console.error(error.stderr.toString())
    process.exit(1)
  }
  const entryPoints = glob.sync('src/**/*.{ts,tsx}', {cwd})
  return build({
    absWorkingDir: cwd,
    format: 'esm',
    bundle: true,
    sourcemap: true,
    entryPoints,
    outdir: 'dist',
    inject: [__dirname + '/react-shim.js'],
    plugins: [
      externalPlugin,
      ScssModulesPlugin({
        cache: false,
        localsConvention: 'dashes'
      })
    ]
  }).then(() => console.log(`> ${location}`))
}

Promise.all(
  packages
    .filter(package => !package.includes('node_modules'))
    .map(buildPackage)
).catch(e => {
  console.error(e)
  process.exit(1)
})

//
//
// const res = spawn.sync(tsc, [], {stdio: 'inherit'})
//
// if (res.status !== 0) process.exit(res.status)
//
// const externalPlugin = {
//   name: 'external-plugin',
//   setup(build) {
//     build.onResolve({filter: /^[^\.](.*?)$/}, args => {
//       return {path: args.path, external: true}
//     })
//   }
// }
//
// build({
//   format: 'esm',
//   bundle: true,
//   sourcemap: true,
//   entryPoints: glob.sync('src/**/*.{ts,tsx}'),
//   outdir: 'dist',
//   inject: [__dirname + '/react-shim.js'],
//   plugins: [
//     externalPlugin,
//     ScssModulesPlugin({
//       cache: false,
//       localsConvention: 'dashes'
//     })
//   ]
// })
//
