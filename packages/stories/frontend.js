const {serve} = require('esbuild')
const alias = require('esbuild-plugin-alias')
const {ScssModulesPlugin} = require('esbuild-scss-modules-plugin')
const path = require('path')
const fs = require('fs')

const usePreact = true

/*
These should resolved using the conditional exports, but before building
those are not available so we point at the source directly.
*/
const packages = fs.readdirSync('../input')
const aliases = Object.fromEntries(
  packages.map(package => {
    return [
      `@alinea/input.${package}`,
      path.resolve(`../input/${package}/src/browser.ts`)
    ]
  })
)

if (usePreact) {
  aliases.react = require.resolve('preact/compat')
  aliases['react-dom'] = require.resolve('preact/compat')
}

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
    inject: ['../../scripts/react-shim.js'],
    plugins: [
      ScssModulesPlugin({
        cache: false,
        localsConvention: 'dashes',
        generateScopedName: 'alinea-[name]-[local]-[hash:base64:5]'
      }),
      alias(aliases)
    ],
    loader: {
      '.woff': 'file',
      '.woff2': 'file'
    },
    define: {
      'process.env.__NEXT_TRAILING_SLASH': true,
      'process.env.__NEXT_I18N_SUPPORT': false,
      'process.env.__NEXT_ROUTER_BASEPATH': '""',
      'process.env.__NEXT_SCROLL_RESTORATION': true,
      'process.env.__NEXT_HAS_REWRITES': false,
      'process.env.__NEXT_OPTIMIZE_CSS': false,
      'process.env.__NEXT_CROSS_ORIGIN': '""',
      'process.env.__NEXT_STRICT_MODE': false,
      'process.env.__NEXT_IMAGE_OPTS': null
    }
  }
).then(res => {
  console.log(`\n\x1b[36m> Serving on http://localhost:${res.port}\x1b[39m\n`)
})
