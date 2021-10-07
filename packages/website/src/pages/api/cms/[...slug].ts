import {LocalHub, Server} from '@alinea/server'
import {pagesSchema} from '../../../schema'

const cacheDir =
  process.env.NODE_ENV === 'production' ? 'packages/website/' : ''

const server = new Server({
  dashboardUrl: '/admin',
  hub: new LocalHub({
    schema: pagesSchema,
    contentPath: 'content',
    cacheFile: `${cacheDir}.next/server/chunks/content`
  })
})

export default server.respond
