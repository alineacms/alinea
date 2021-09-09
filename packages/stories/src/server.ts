import {serve} from '@alinea/server'
import {createServer} from 'http'

createServer(
  serve({
    name: 'stories'
  })
).listen(4500)
