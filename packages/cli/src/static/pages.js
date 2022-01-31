import {Pages} from '@alinea/server'
import {cache} from './cache.js'
import {schema} from './schema.js'

export const pages = cache.then(createCache => new Pages(schema, createCache))
