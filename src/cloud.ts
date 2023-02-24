import {BackendConfig} from 'alinea/core/BackendConfig'
import {
  CloudAuthServer,
  CloudAuthServerOptions
} from './cloud/server/CloudAuthServer.js'
import {CloudBackend} from './cloud/server/CloudBackend.js'

export function createCloudBackend(): BackendConfig<CloudAuthServerOptions> {
  return {
    auth: {
      view: undefined!,
      configure: options => new CloudAuthServer(options)
    },
    configureBackend: options => new CloudBackend(options)
  }
}
