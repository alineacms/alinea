#!/usr/bin/env node
const {serve} = require('esbuild')
const alias = require('esbuild-plugin-alias')
const {ScssModulesPlugin} = require('esbuild-scss-modules-plugin')

serve(
  {
    servedir: '.',
    host: '127.0.0.1'
  },
  {
    entryPoints: ['src/client.ts'],
    outdir: 'dist',
    bundle: true,
    sourcemap: true,
    minify: true,
    plugins: [
      ScssModulesPlugin({
        cache: false,
        localsConvention: 'dashes'
      }),
      alias({
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
