import {DevBackend} from 'alinea/cli/serve/backend/DevBackend'
import {config} from './config.js'
import {serverLocation} from './drafts.js'
import {createStore} from './store.js'
const options = {config, createStore}
export const backend =
  process.env.NODE_ENV === 'development'
    ? new DevBackend({...options, serverLocation})
    : config.createBackend(options)
