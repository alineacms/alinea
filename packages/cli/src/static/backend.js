import {DevBackend} from '@alinea/backend/DevBackend'
import {config} from './config.js'
import {createStore as createDraftStore} from './drafts.js'
import {createStore} from './store.js'
const options = {config, createStore}
export const backend =
  process.env.NODE_ENV === 'development'
    ? new DevBackend({...options, createDraftStore})
    : config.createBackend(options)
