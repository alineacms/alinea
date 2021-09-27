import {LocalHub, Server} from '@alinea/server'
import {createServer} from 'http'
import {schema} from './schema'

const server = new Server(new LocalHub(schema, './content'))

createServer(server.respond).on('upgrade', server.upgrade).listen(4500)
