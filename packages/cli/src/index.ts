import {getCachedIndex} from '@alinea/index'
import sade from 'sade'

const prog = sade('alinea')

prog
  .version('0.0.0')
  .command('index <content>')
  .describe('Index the content directory. Expects json files.')
  .action(async dir => {
    await getCachedIndex(dir)
  })

prog.parse(process.argv)
