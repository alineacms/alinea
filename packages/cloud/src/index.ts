import {BackendConfig} from '@alinea/core/BackendConfig'
import {cloudAuth} from './CloudAuth'
import {CloudAuthServerOptions} from './server/CloudAuthServer'
import {CloudBackend} from './server/CloudBackend'

export function createCloudBackend(): BackendConfig<CloudAuthServerOptions> {
  return {
    auth: cloudAuth,
    configureBackend: options => new CloudBackend(options)
  }
}
