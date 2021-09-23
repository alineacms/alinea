const {serve} = require('esbuild')
const alias = require('esbuild-plugin-alias')
const {ScssModulesPlugin} = require('esbuild-scss-modules-plugin')
const path = require('path')
const fs = require('fs')

/*
These should resolved using the conditional exports, but before building
those are not available so we point at the source directly.
*/
const packages = fs.readdirSync('../input')
const inputAliases = Object.fromEntries(
  packages.map(package => {
    return [
      `@alinea/input.${package}`,
      path.resolve(`../input/${package}/src/browser.ts`)
    ]
  })
)

serve(
  {
    servedir: '.',
    host: '127.0.0.1'
  },
  {
    format: 'esm',
    splitting: true,
    entryPoints: ['src/client.ts'],
    outdir: 'dist',
    bundle: true,
    sourcemap: true,
    minify: true,
    inject: ['../../scripts/react-shim.js'],
    plugins: [
      ScssModulesPlugin({
        cache: false,
        localsConvention: 'dashes'
      }),
      alias({
        ...inputAliases,
        react: require.resolve('preact/compat'),
        'react-dom': require.resolve('preact/compat')
      })
    ],
    loader: {
      '.woff': 'file',
      '.woff2': 'file'
    }
  }
).then(res => {
  console.log(`\n\x1b[36m> Serving on http://${res.host}:${res.port}\x1b[39m\n`)
})
