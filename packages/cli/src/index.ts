import {ContentIndex} from '@alinea/index'
import sade from 'sade'

const prog = sade('alinea')

prog
  .version('0.0.0')
  .command('index <content>')
  .describe('Index the content directory. Expects json files.')
  .option('-o, --output', 'Change the output directory')
  .action(async (dir, opts) => {
    const index = ContentIndex.fromCacheFile(opts.output)
    await index.indexDirectory(dir)
  })

prog.parse(process.argv)
