#!/usr/bin/env node

import sade from 'sade'
import {version} from '../package.json'
import {ensureEnv} from './util/EnsureEnv'
import {ensureNodeResolution} from './util/EnsureNodeResolution'
import {ensureReact} from './util/EnsureReact'

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
  .action(async args => {
    ensureNodeResolution()
    ensureReact()
    const {generate} = await import('./Generate')
    return generate({configFile: args.config, watch: args.watch})
  })
  .command('init [dir]')
  .describe('Copy a sample config file to the current directory')
  .action(async (dir, args) => {
    ensureNodeResolution()
    ensureReact()
    const {init} = await import('./Init')
    return init({cwd: dir, ...args})
  })
  .command('serve [dir]')
  .describe('Start a development dashboard')
  .option('-p, --port', `Port to listen on`)
  .option('--production', `Use production backend`)
  .action(async (dir, args) => {
    ensureNodeResolution()
    ensureReact()
    ensureEnv(dir || process.cwd())
    const {serve} = await import('./Serve')
    return serve({cwd: dir, ...args})
  })

prog.parse(process.argv)
