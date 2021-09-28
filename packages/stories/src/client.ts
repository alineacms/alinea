import {init} from '@alinea/dashboard'
import {mySchema} from './schema'

init({schema: mySchema, api: 'http://localhost:4500'})
