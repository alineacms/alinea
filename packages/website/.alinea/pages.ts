import {Pages} from '@alinea/server'
import {cache} from './cache'
import {schema} from './schema'

export const pages = new Pages(schema, await cache.store)

export const {all, first} = pages
