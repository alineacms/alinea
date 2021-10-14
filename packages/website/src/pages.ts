import {ContentIndex} from '@alinea/index'
import {Pages} from '@alinea/server'
import {schema} from './schema'

const index = await ContentIndex.fromCacheFile(
  `.next/server/chunks/content`
).indexDirectory('content')

export const pages = new Pages(schema, await index.store)
