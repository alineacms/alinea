import {Backend} from 'alinea/backend/Backend'
import * as driver from 'rado/driver'
import {basicAuth} from './BasicAuth.js'
import {databaseApi} from './DatabaseApi.js'
import {githubApi, GithubOptions} from './GithubApi.js'

export type AvailableDrivers = keyof typeof driver

export interface BackendOptions<Driver extends AvailableDrivers> {
  auth(username: string, password: string): boolean | Promise<boolean>
  database: {
    driver: Driver
    client: Parameters<(typeof driver)[Driver]>[0]
  }
  github: GithubOptions
}

export function createBackend<Driver extends AvailableDrivers>(
  options: BackendOptions<Driver>
): Backend {
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
