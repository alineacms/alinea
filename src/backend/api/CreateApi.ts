import {Backend} from 'alinea/backend'
import {Database} from 'rado'
import {basicAuth} from './BasicAuth.js'
import {databaseApi} from './DatabaseApi.js'
import {githubApi, GithubOptions} from './GithubApi.js'

export interface ApiOptions {
  db: Database
  auth: (username: string, password: string) => boolean | Promise<boolean>
  github: GithubOptions
}

export function createApi(options: ApiOptions): Backend {
  const ghApi = githubApi(options.github)
  const dbApi = databaseApi({...options, target: ghApi.target})
  const auth = basicAuth(options.auth)
  return {
    ...ghApi,
    ...dbApi,
    auth
  }
}
