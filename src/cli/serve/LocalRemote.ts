import {createRemote} from 'alinea/backend/api/CreateBackend'
import {gitUser} from 'alinea/backend/util/ExecGit'
import {CloudRemote} from 'alinea/cloud/CloudRemote'
import type {Config} from 'alinea/core/Config'
import type {RemoteConnection, RequestContext} from 'alinea/core/Connection'
import {DevDB} from '../generate/DevDB.js'
import {GitHistory} from './GitHistory.js'
import {LocalAuth} from './LocalAuth.js'

export function localRemote(config: Config) {
  if (process.env.NODE_ENV === 'development') return devRemote(config)
  return cloudRemote(config)
}

function cloudRemote(config: Config) {
  return (context: RequestContext): RemoteConnection => {
    return new CloudRemote(context, config)
  }
}

function devRemote(config: Config) {
  const rootDir = process.cwd()
  const user = gitUser(rootDir)
  const history = new GitHistory(config, rootDir)
  const db = new DevDB({
    config: config,
    rootDir
  })
  return (context: RequestContext): RemoteConnection => {
    const auth = new LocalAuth(context, user)
    return createRemote(auth, db, history)
  }
}
