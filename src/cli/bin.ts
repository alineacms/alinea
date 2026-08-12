import sade from 'sade'
// @ts-ignore
import pkg from '../../package.json'
import {ensureEnv} from './util/EnsureEnv.js'
import {ensureLibs} from './util/EnsureLibs.js'
import {ensureNode} from './util/EnsureNode.js'
import {forwardCommand} from './util/ForwardCommand.js'

const prog = sade('alinea')

const libs = {
  react: '18.0.0',
  'react-dom': '18.0.0'
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
  .option('-b, --base', 'Base URL for previews')
  .option('--production', 'Use production backend')
  .option('--dev', 'Watch alinea sources')
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
      base: args.base,
      onAfterGenerate,
      configFile: args.config,
      cmd: 'dev'
    })
  })

  .command('build')
  .alias('generate')
  .describe('Generate types and content cache')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('-w, --watch', 'Watch for changes to source files')
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
        ...args,
        cwd: args.dir,
        base: args.base,
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

prog
  .command('content schema')
  .describe('Output the content schema as JSON')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('-t, --type', 'Only output a single type')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    ensureEnv(args.dir)
    const content = await import('./content/Content.js')
    return content.schema(args)
  })

prog
  .command('content operations')
  .describe('Output JSON operation documentation')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    const content = await import('./content/Content.js')
    return content.operations(args)
  })

prog
  .command('content get')
  .describe('Get one entry as JSON')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('--id', 'Entry id')
  .option('--locale', 'Filter by locale, or "none" for non-localized entries')
  .option('--status', 'Status filter')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    ensureEnv(args.dir)
    const content = await import('./content/Content.js')
    return content.get(args)
  })

prog
  .command('content list')
  .describe('List entries as JSON')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('-t, --type', 'Filter by type')
  .option('--workspace', 'Filter by workspace')
  .option('--root', 'Filter by root')
  .option('--parent-id', 'Filter by parent id')
  .option('--locale', 'Filter by locale, or "none" for non-localized entries')
  .option('--status', 'Status filter')
  .option('--limit', 'Maximum number of entries')
  .option('--offset', 'Entries to skip')
  .option('--include-data', 'Include field data')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    ensureEnv(args.dir)
    const content = await import('./content/Content.js')
    return content.list(args)
  })

prog
  .command('content validate')
  .describe('Validate JSON content operations')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('-i, --input', 'JSON or NDJSON input file')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    ensureEnv(args.dir)
    const content = await import('./content/Content.js')
    return content.validate(args)
  })

prog
  .command('content apply')
  .describe('Apply JSON content operations')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('-i, --input', 'JSON or NDJSON input file')
  .option('--dry-run', 'Validate and summarize changes without writing')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    ensureEnv(args.dir)
    const content = await import('./content/Content.js')
    return content.apply(args)
  })

prog
  .command('content media import')
  .describe('Import a media file and create a MediaFile entry')
  .option('-c, --config', 'Config file location')
  .option('-d, --dir', 'Root directory of the project')
  .option('-f, --file', 'File to import')
  .option('--stdin', 'Read file contents from stdin')
  .option('--name', 'File name to use with --stdin')
  .option('--workspace', 'Workspace name')
  .option('--root', 'Media root name')
  .option('--parent-id', 'Parent media directory entry id')
  .option('--replace-id', 'Replace an existing MediaFile entry')
  .option('--dry-run', 'Validate file input without writing')
  .option('--no-preview', 'Skip server-side image preview generation')
  .action(async args => {
    ensureNode()
    ensureLibs(libs)
    ensureEnv(args.dir)
    const content = await import('./content/Content.js')
    return content.importMedia(args)
  })

if (
  process.argv[2] === 'content' &&
  (!process.argv[3] || process.argv[3] === '--help' || process.argv[3] === '-h')
) {
  console.log(`\
  Description
    Inspect and mutate Alinea content using JSON.
    Start with schema and list commands to discover valid workspaces, roots, locales, types, fields, and entry ids.
    Use operations for machine-readable mutation payload documentation.

  Usage
    $ alinea content <command> [options]

  Available Commands
    schema          Output the content schema as JSON
    list            List entries as JSON
    get             Get one entry as JSON
    operations      Output JSON operation documentation
    validate        Validate JSON content operations
    apply           Apply JSON content operations
    media import    Import a media file and create a MediaFile entry

  Examples
    $ alinea content schema --json
    $ alinea content list --json
    $ alinea content operations --json
    $ alinea content validate --input op.json --json
    $ alinea content apply --dry-run --input op.json --json
    $ alinea content media import --file ./image.jpg --json
`)
  process.exit(0)
}

prog.parse(process.argv)
