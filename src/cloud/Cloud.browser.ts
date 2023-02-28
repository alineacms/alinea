import type {BackendConfig} from 'alinea/core/BackendConfig'
import type {CloudAuthServerOptions} from './server/CloudAuthServer.js'
import {CloudAuthView} from './view/CloudAuthView.js'

export function createCloudBackend(): BackendConfig<CloudAuthServerOptions> {
  return {
    auth: {
      view: CloudAuthView,
      configure: undefined!
    },
    configureBackend: undefined!
  }
}
