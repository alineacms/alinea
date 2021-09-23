#!/usr/bin/env node
const {build} = require('estrella')

const common = {
  clear: false,
  tslint: true,
  quiet: true,
  bundle: true,
  sourcemap: true
}

/*build({
  ...common,
  platform: 'browser',
  entry: 'src/client.ts',
  outfile: 'dist/client.js'
})*/

build({
  ...common,
  tslint: {
    mode: 'on',
    quiet: true
  },
  platform: 'node',
  entry: 'src/server.ts',
  outfile: 'dist/server.js',
  external: ['better-sqlite3', '@alinea/input.text/TextInput'],
  run: ['node', '--enable-source-maps', 'dist/server.js']
})
