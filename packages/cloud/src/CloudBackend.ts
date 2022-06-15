import {BackendConfig} from '@alinea/core/BackendConfig'
import {cloudAuth} from './CloudAuth'

export function createCloudBackend(): BackendConfig {
  return {
    auth: cloudAuth,
    configureBackend: () => undefined!
  }
}
