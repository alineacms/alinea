import {BackendConfig} from 'alinea/core/BackendConfig'
import {
  CloudAuthServer,
  CloudAuthServerOptions
} from './server/CloudAuthServer.js'
import {CloudBackend} from './server/CloudBackend.js'

export function createCloudBackend(): BackendConfig<CloudAuthServerOptions> {
  return {
    auth: {
      view: undefined!,
      configure: options => new CloudAuthServer(options)
    },
    configureBackend: options => new CloudBackend(options)
  }
}
