import {Backend} from 'alinea/backend/Backend'
import * as driver from 'rado/driver'
import {basicAuth} from './BasicAuth.js'
import {databaseApi} from './DatabaseApi.js'
import {githubApi, GithubOptions} from './GithubApi.js'

export type AvailableDrivers =
  | 'd1'
  | 'mysql2'
  | '@neondatabase/serverless'
  | '@vercel/postgres'
  | 'pg'
  | '@electric-sql/pglite'
  | 'sql.js'
  | '@libsql/client'

type DatabaseClient<Driver extends AvailableDrivers> = Parameters<
  (typeof driver)[Driver]
>[0]
type DatabaseOption<Driver extends AvailableDrivers> = {
  driver: Driver
  client: DatabaseClient<Driver>
}

export type DatabaseDeclaration =
  | DatabaseOption<'d1'>
  | DatabaseOption<'mysql2'>
  | DatabaseOption<'@neondatabase/serverless'>
  | DatabaseOption<'@vercel/postgres'>
  | DatabaseOption<'pg'>
  | DatabaseOption<'@electric-sql/pglite'>
  | DatabaseOption<'sql.js'>
  | DatabaseOption<'@libsql/client'>

export interface BackendOptions {
  auth(username: string, password: string): boolean | Promise<boolean>
  database: DatabaseDeclaration
  github: GithubOptions
}

export function createBackend(options: BackendOptions): Backend {
  const ghApi = githubApi(options.github)
  const db = driver[options.database.driver](options.database.client)
  const dbApi = databaseApi({...options, db, target: ghApi.target})
  const auth = basicAuth(options.auth)
  return {
    ...ghApi,
    ...dbApi,
    auth
  }
}
