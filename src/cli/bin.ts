import sade from 'sade'
// @ts-ignore
import pkg from '../../package.json'
import {ensureEnv} from './util/EnsureEnv.js'
import {ensureNode} from './util/EnsureNode.js'
import {ensureReact} from './util/EnsureReact.js'
import {forwardCommand} from './util/ForwardCommand.js'

const prog = sade('alinea')

prog
  .version(pkg.version)

  .command('init')
  .describe('Copy a sample config file to the current directory')
  .option('--next', `Configure for Next.js`)
  .action(async args => {
    ensureNode()
    ensureReact()
    const {init} = await import('./Init.js')
    return init(args)
  })

  .command('dev')
  .alias('serve')
  .describe('Start a development dashboard')
  .option('-c, --config', `Config file location`)
  .option('-d, --dir', `Root directory of the project`)
  .option('-p, --port', `Port to listen on`)
  .option('--production', `Use production backend`)
  .option('--dev', `Watch alinea sources`)
  .action(async args => {
    ensureNode()
    ensureReact()
    ensureEnv(args.dir)
    process.env.NODE_ENV = args.production ? 'production' : 'development'
    const {serve} = await import('./Serve.js')
    return serve({
      ...args,
      alineaDev: args.dev,
      cwd: args.dir,
      onAfterGenerate: forwardCommand,
      configFile: args.config
    })
  })

  .command('build')
  .alias('generate')
  .describe('Generate types and content cache')
  .option('-c, --config', `Config file location`)
  .option('-w, --watch', `Watch for changes to source files`)
  .option('-d, --dir', `Root directory of the project`)
  .option(
    '--fix',
    `Any missing or incorrect properties will be overwritten by their default`
  )
  .action(async args => {
    ensureNode()
    ensureReact()
    ensureEnv(args.dir)
    process.env.NODE_ENV = 'production'
    const {generate} = await import('./Generate.js')
    for await ({} of generate({
      cwd: args.dir,
      watch: args.watch,
      fix: args.fix,
      onAfterGenerate: forwardCommand,
      configFile: args.config
    })) {
    }
  })

prog.parse(process.argv)
