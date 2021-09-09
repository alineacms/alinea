#!/usr/bin/env node
const {build} = require('estrella')

const common = {
  clear: false,
  tslint: true,
  quiet: true,
  bundle: true
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
  outfile: 'dist/server.js'
})
