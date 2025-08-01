import type {Config} from 'alinea/core/Config'
import type {RemoteConnection, RequestContext} from 'alinea/core/Connection'
import {assert} from 'alinea/core/util/Assert'
import * as driver from 'rado/driver'
import {BasicAuth} from './BasicAuth.js'
import {DatabaseApi} from './DatabaseApi.js'
import {GithubApi, type GithubOptions} from './GithubApi.js'
import {OAuth2, type OAuth2Options} from './OAuth2.js'

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
  auth?(username: string, password: string): boolean | Promise<boolean>
  oauth2?: OAuth2Options
  database: DatabaseDeclaration
  github: GithubOptions
}

export function createBackend(
  config: Config,
  options: BackendOptions
): (context: RequestContext) => RemoteConnection {
  const db = driver[options.database.driver](options.database.client)
  return context => {
    const {user} = context
    const author =
      user?.name && user.email
        ? {name: user.name, email: user.email}
        : undefined
    const ghApi = new GithubApi({
      author,
      ...options.github
    })
    const dbApi = new DatabaseApi(context, {db})
    assert(options.oauth2 ?? options.auth, 'No auth method provided')
    const auth = options.oauth2
      ? new OAuth2(context, config, options.oauth2)
      : new BasicAuth(context, options.auth!)
    return createRemote(ghApi, dbApi, auth)
  }
}

export function createRemote(
  ...impl: Array<Partial<RemoteConnection>>
): RemoteConnection {
  const reversed = impl.reverse()
  const call = (name: keyof RemoteConnection): any => {
    const use = reversed.find(i => name in i)
    return use
      ? use[name]!.bind(use)
      : () => {
          throw new Error(`Backend does not implement ${name}`)
        }
  }
  return {
    authenticate: call('authenticate'),
    verify: call('verify'),
    getTreeIfDifferent: call('getTreeIfDifferent'),
    getBlobs: call('getBlobs'),
    write: call('write'),
    revisions: call('revisions'),
    revisionData: call('revisionData'),
    getDraft: call('getDraft'),
    storeDraft: call('storeDraft'),
    prepareUpload: call('prepareUpload'),
    handleUpload: call('handleUpload'),
    previewUpload: call('previewUpload')
  }
}
