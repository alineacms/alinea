import {Pages} from '@alinea/server'
import {store} from './cache.js'
import {schema} from './schema.js'

export const pages = store.then(store => new Pages(schema, store))

// export const {all, first} = pages
