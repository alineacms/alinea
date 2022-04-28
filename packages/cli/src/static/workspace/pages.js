import {Pages} from '@alinea/backend'
import {config} from '../config.js'
import {createStore} from '../store.js'
import {workspace} from './schema.js'

export const pages = new Pages(config, workspace, createStore)
