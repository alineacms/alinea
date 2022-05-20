import {Pages} from '@alinea/backend'
import {createStore} from '../store.js'
import {workspace} from './schema.js'

export const pages = new Pages(workspace, createStore)
