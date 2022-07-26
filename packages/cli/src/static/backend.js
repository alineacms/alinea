import {config} from './config.js'
import {createStore} from './store.js'
const options = {config, createStore}
export const backend = config.createBackend(options)
