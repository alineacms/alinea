import * as driver from 'rado/driver'
import type {BackendPart, DatabaseDeclaration} from './CreateBackend.js'
import {DatabaseApi} from './DatabaseApi.js'
import {SubmissionStore} from './SubmissionStore.js'

export function database(options: DatabaseDeclaration): BackendPart {
  const db = driver[options.driver](options.client as never)
  // The submissions of forms are kept in the same database
  const submissions = new SubmissionStore({db})
  return context => [new DatabaseApi(context, {db}), submissions]
}
