import sade from 'sade'
// @ts-ignore
import pkg from '../../package.json'
import {ensureEnv} from './util/EnsureEnv.js'
import {ensureLibs} from './util/EnsureLibs.js'
import {ensureNode} from './util/EnsureNode.js'
import {forwardCommand} from './util/ForwardCommand.js'

const prog = sade('alinea')

const libs = {
  react: '19.0.0',
  'react-dom': '19.0.0'
}

prog
  .version(pkg.version)

  .command('init')
  .describe('Initialize a new Alinea project in the current directory')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    const {init} = await import('./Init.js')
    return init(args)
  })

  .command('dev')
  .alias('serve')
  .describe('Start a development dashboard')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('-p, --port', 'Port to listen on')
  .option('--production', 'Use production backend')
  .option('--dev', 'Watch alinea sources')
  .option('--role', 'Sign in locally with this role, repeat for more')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    ensureEnv(args.dir)
    process.env.NODE_ENV = args.production ? 'production' : 'development'
    const {serve} = await import('./Serve.js')
    const onAfterGenerate = forwardCommand()
    return serve({
      ...args,
      alineaDev: args.dev,
      cwd: args.dir,
      onAfterGenerate,
      configFile: args.config,
      roles:
        args.role &&
        [args.role].flat().filter(role => typeof role === 'string'),
      cmd: 'dev'
    })
  })

  .command('mcp')
  .describe('Connect coding agents to the content of the running dev server')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .action(async args => {
    ensureNode()
    const {mcp} = await import('./Mcp.js')
    return mcp({cwd: args.dir, configFile: args.config})
  })

  .command('build')
  .alias('generate')
  .describe('Generate types and content cache')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option(
    '--fix',
    'Any missing or incorrect properties will be overwritten by their default'
  )
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    ensureEnv(args.dir)
    process.env.NODE_ENV = 'production'
    if (args.fix) {
      const {generate} = await import('./Generate.js')
      for await (const _ of generate({
        fix: true,
        cwd: args.dir,
        configFile: args.config,
        onAfterGenerate() {
          process.exit(0)
        },
        cmd: 'build'
      })) {
      }
      return
    }
    const {serve} = await import('./Serve.js')
    const onAfterGenerate = forwardCommand()
    return serve({
      ...args,
      alineaDev: args.dev,
      cwd: args.dir,
      production: true,
      onAfterGenerate: env => {
        if (onAfterGenerate) onAfterGenerate(env)
        else process.exit(0)
      },
      configFile: args.config,
      cmd: 'build'
    })
  })

  .command('merge-driver [base] [ours] [theirs] [path]')
  .describe(
    'Merge content files for git as the server merges saves. ' +
      'Run `alinea merge-driver install` once to let git use it'
  )
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('--prefer', 'The side that wins what both changed', 'ours')
  .action(async (base, ours, theirs, file, args) => {
    ensureNode()
    const {installMergeDriver, mergeDriver} = await import('./MergeDriver.js')
    if (base === 'install') {
      const {attributes, driver} = await installMergeDriver({
        cwd: args.dir,
        configFile: args.config
      })
      console.log(`> .gitattributes: ${attributes}`)
      console.log(`> git config merge.alinea.driver: ${driver}`)
      return
    }
    if (!base || !ours || !theirs || !file) {
      console.error('Usage: alinea merge-driver %O %A %B %P')
      process.exit(2)
    }
    const prefer = args.prefer === 'theirs' ? 'theirs' : 'ours'
    await mergeDriver(
      {base, ours, theirs, path: file},
      {dir: args.dir, configFile: args.config, prefer}
    )
  })

prog.parse(process.argv)
