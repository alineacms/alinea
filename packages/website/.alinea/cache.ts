import {Cache} from '@alinea/cache'
import {schema} from './schema'

export const cache = Cache.fromFile({
  schema,
  dir: 'content',
  cacheFile: `.next/server/chunks/content`
})
