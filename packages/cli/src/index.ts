import {getCachedIndex} from '@alinea/index'
import sade from 'sade'

const prog = sade('alinea')

prog
  .version('0.0.0')
  .command('index <content>')
  .describe('Index the content directory. Expects json files.')
  .option('-o, --output', 'Change the output directory')
  .action(async (dir, opts) => {
    await getCachedIndex(dir, opts.output)
  })

prog.parse(process.argv)
