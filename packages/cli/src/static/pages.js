import {Pages} from '@alinea/server'
import {createCache} from './cache.js'
import {schema} from './schema.js'

export const pages = new Pages(schema, createCache)

// export const {all, first} = pages
