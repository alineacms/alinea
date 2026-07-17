import type {Config} from '#/core/Config.js'
import type {RemoteConnection, RequestContext} from '#/core/Connection.js'
import {assert} from '#/core/util/Assert.js'
import * as driver from 'rado/driver'
import {BasicAuth} from './BasicAuth.js'
import {DatabaseApi} from './DatabaseApi.js'
import {GithubApi, type GithubOptions} from './GithubApi.js'
import {OAuth2, type OAuth2Options} from './OAuth2.js'
import {S3Uploads, type S3UploadsOptions} from './S3Uploads.js'

export type BackendPart =
  | Partial<RemoteConnection>
  | ((context: RequestContext, config: Config) => Partial<RemoteConnection>)

export interface BackendFactory {
  (context: RequestContext, config: Config): RemoteConnection
}

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
  uploads?: {
    s3: S3UploadsOptions
  }
}

export function backendFromOptions(options: BackendOptions): BackendFactory {
  const db = driver[options.database.driver](options.database.client)
  return (context, config) => {
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
    const uploadsApi = options.uploads?.s3
      ? new S3Uploads(options.uploads.s3, config.maxUploadSize)
      : undefined
    assert(options.oauth2 ?? options.auth, 'No auth method provided')
    const auth = options.oauth2
      ? new OAuth2(context, config, options.oauth2)
      : new BasicAuth(context, options.auth!)
    return composeBackend(ghApi, dbApi, uploadsApi ?? {}, auth)
  }
}

export function createBackend(...parts: Array<BackendPart>): BackendFactory {
  return (context, config) => {
    return composeBackend(
      ...parts.map(part =>
        typeof part === 'function' ? part(context, config) : part
      )
    )
  }
}

export function composeBackend(
  ...impl: Array<Partial<RemoteConnection>>
): RemoteConnection {
  const hasMethod = (name: keyof RemoteConnection): boolean => {
    return impl.some(i => typeof i[name] === 'function')
  }
  const fallback: Partial<RemoteConnection> = {
    async enrichUser(user) {
      return user
    },
    async capabilities() {
      return {
        users: hasMethod('listUsers')
      }
    }
  }
  const reversed = [...impl].reverse().concat(fallback)
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
    capabilities: call('capabilities'),
    getTreeIfDifferent: call('getTreeIfDifferent'),
    getBlobs: call('getBlobs'),
    write: call('write'),
    revisions: call('revisions'),
    revisionData: call('revisionData'),
    getDraft: call('getDraft'),
    storeDraft: call('storeDraft'),
    prepareUpload: call('prepareUpload'),
    handleUpload: call('handleUpload'),
    previewUpload: call('previewUpload'),
    enrichUser: call('enrichUser'),
    listUsers: call('listUsers'),
    createUser: call('createUser'),
    updateUser: call('updateUser'),
    removeUser: call('removeUser')
  }
}
