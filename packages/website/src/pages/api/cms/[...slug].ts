import {ContentIndex} from '@alinea/index'
import {LocalHub, Server} from '@alinea/server'
import {schema} from '../../../schema'

const cacheDir =
  process.env.NODE_ENV === 'production' ? 'packages/website/' : ''

const server = new Server({
  dashboardUrl: '/admin',
  hub: new LocalHub({
    schema: schema,
    index: ContentIndex.fromCacheFile(`${cacheDir}.next/server/chunks/content`)
  })
})

export default server.respond
