import {Pages} from '@alinea/backend'
import {config} from '../config.js'
import {createStore} from '../store.js'
export * from './schema.js'
const workspace = config.workspaces['$WORKSPACE']
export const pages = new Pages(config, workspace, createStore)
