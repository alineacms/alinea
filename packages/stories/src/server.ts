import {LocalHub, Server} from '@alinea/server'
import {createServer} from 'http'
import {mySchema} from './schema'

const server = new Server(new LocalHub(mySchema, './content'))

createServer(server.respond).on('upgrade', server.upgrade).listen(4500)

// Todo: "build": "alinea track-build -- next build"
