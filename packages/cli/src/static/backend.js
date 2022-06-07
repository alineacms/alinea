import {DevBackend} from '@alinea/backend'
import dotenv from 'dotenv'
import findConfig from 'find-config'
import {config} from './config.js'
import {createStore} from './store.js'
dotenv.config({path: findConfig('.env')})
const options = {config, createStore}
export const backend =
  process.env.NODE_ENV === 'development'
    ? new DevBackend(options)
    : config.createBackend(options)
