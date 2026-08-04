import * as driver from 'rado/driver'
import type {BackendPart, DatabaseDeclaration} from './CreateBackend.js'
import {DatabaseApi} from './DatabaseApi.js'

export function database(options: DatabaseDeclaration): BackendPart {
  const db = driver[options.driver](options.client as never)
  return context => new DatabaseApi(context, {db})
}
