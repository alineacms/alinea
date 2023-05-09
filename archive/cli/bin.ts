import sade from 'sade'
// @ts-ignore
import {version} from '../../package.json'
import {ensureEnv} from './util/EnsureEnv.js'
import {ensureNodeResolution} from './util/EnsureNodeResolution.js'
import {ensureReact} from './util/EnsureReact.js'
import {forwardCommand} from './util/ForwardCommand.js'

const prog = sade('alinea')

prog
  .version(version)
  .command('generate')
  .describe('Generate types and content cache')
  .option('-w, --watch', `Watch for changes to source files`)
  .option('-d, --dir', `Directory containing the alinea config file`)
  .option(
    '--fix',
    `Any missing or incorrect properties will be overwritten by their default`
  )
  .action(async args => {
    ensureNodeResolution()
    ensureReact()
    const {generate} = await import('./Generate.js')
    for await (const _ of generate({
      cwd: args.dir,
      watch: args.watch,
      fix: args.fix,
      onAfterGenerate: forwardCommand
    })) {
    }
  })
  .command('init')
  .describe('Copy a sample config file to the current directory')
  .action(async args => {
    ensureNodeResolution()
    ensureReact()
    const {init} = await import('./Init.js')
    return init(args)
  })
  .command('serve')
  .describe('Start a development dashboard')
  .option('-p, --port', `Port to listen on`)
  .option('--production', `Use production backend`)
  .action(async args => {
    ensureNodeResolution()
    ensureReact()
    ensureEnv(process.cwd())
    process.env.NODE_ENV = args.production ? 'production' : 'development'
    const {serve} = await import('./Serve.js')
    return serve({...args, onAfterGenerate: () => forwardCommand(true)})
  })

prog.parse(process.argv)
