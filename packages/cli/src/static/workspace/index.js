import {Pages} from '@alinea/server'
import {createCache} from '../cache.js'
import {config} from '../config.js'
export * from './schema.js'
const workspace = config.workspaces['$WORKSPACE']
export const pages = new Pages(config, workspace, createCache)
