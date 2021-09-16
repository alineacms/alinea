import {LocalHub, serve} from '@alinea/server'
import {createServer} from 'http'

createServer(serve(new LocalHub('./content'))).listen(4500)
