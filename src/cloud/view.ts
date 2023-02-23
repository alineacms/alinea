import type {BackendConfig} from 'alinea/core/BackendConfig'
import type {CloudAuthServerOptions} from './server/CloudAuthServer'
import {CloudAuthView} from './view/CloudAuthView'

export function createCloudBackend(): BackendConfig<CloudAuthServerOptions> {
  return {
    auth: {
      view: CloudAuthView,
      configure: undefined!
    },
    configureBackend: undefined!
  }
}
