#!/usr/bin/env node

import sade from 'sade'
import {version} from '../package.json'
import {generate} from './Generate'
import {ensureNodeResolution} from './util/EnsureNodeResolution'

const prog = sade('alinea')

prog
  .version(version)
  .command('generate')
  .describe('Generate types and content cache')
  .option('-w, --watch', `Watch for changes to source files`)
  .option(
    '-c, --config',
    `Location of the config file, defaults to "alinea.config.tsx"`
  )
  .action(args => {
    ensureNodeResolution()
    return generate({configFile: args.config, watch: args.watch})
  })

prog.parse(process.argv)
