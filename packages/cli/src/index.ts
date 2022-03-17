import sade from 'sade'
import {version} from '../package.json'
import {generate} from './Generate'

const prog = sade('alinea')

prog
  .version(version)
  .command('generate')
  .describe('Generate types and content cache')
  .option('-w, --watch', `Watch for changes to source files`)
  .option(
    '-d, --dir',
    `Directory where the config file is found, defaults to ".alinea"`
  )
  .action(generate)

prog.parse(process.argv)
