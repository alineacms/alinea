import {DevBackend} from '@alinea/backend'
import {config} from './config.js'
import {createStore} from './store.js'
const options = {config, createStore}
export const backend =
  process.env.NODE_ENV === 'development'
    ? new DevBackend(options)
    : config.createBackend(options)
