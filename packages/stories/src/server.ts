import {FSHub} from '@alinea/core/drivers/FSHub'
import {serve} from '@alinea/server'
import {createServer} from 'http'

createServer(serve(new FSHub('src'))).listen(4500)
