import {createRequire} from 'module'
import path from 'path'
import sade from 'sade'
import {version} from '../package.json'

const require = createRequire(import.meta.url)

const prog = sade('alinea')

prog
  .version(version)
  .command('index')
  .describe('Index the content directory. Expects json files.')
  .option('-c, --cache', 'Where to find the cache module relative to the cwd')
  .action(async opts => {
    const location = opts.cache || '.alinea/cache.ts'
    require('tsm')
    // Try to create the default cache using .alinea/schema.ts if not exists
    const {cache} = require(path.join(process.cwd(), location))
    await cache.sync()
  })

prog.parse(process.argv)
