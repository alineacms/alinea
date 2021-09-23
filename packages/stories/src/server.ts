import {LocalHub, serve} from '@alinea/server'
import {createServer} from 'http'
import {schema} from './schema'

createServer(serve(new LocalHub(schema, './content'))).listen(4500)
