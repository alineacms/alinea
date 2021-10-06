import {LocalHub} from '@alinea/server'
import {pagesSchema} from './schema'

export const hub = new LocalHub(pagesSchema, 'content')
