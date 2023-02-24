import type {Backend} from 'alinea/backend/Backend'
import type {Store} from 'alinea/store'
import type {Auth} from './Auth.js'
import type {Config} from './Config.js'

export type BackendProps = {
  config: Config
  createStore: () => Promise<Store>
}

export type BackendCreateOptions<AuthOptions> = {
  auth?: Auth<AuthOptions>
} & BackendProps

export type BackendFactory<AuthOptions> = (
  options: BackendCreateOptions<AuthOptions>
) => Backend

export type BackendOptions<AuthOptions> = {
  auth?: Auth<AuthOptions>
}

export type BackendConfig<AuthOptions = {}> = BackendOptions<AuthOptions> & {
  configureBackend: BackendFactory<AuthOptions>
}

export function backend<AuthOptions>(options: BackendOptions<AuthOptions>) {
  return {
    ...options,
    configure(
      configureBackend: BackendFactory<AuthOptions>
    ): BackendConfig<AuthOptions> {
      return {...options, configureBackend}
    }
  }
}

export namespace backend {
  export function configure<AuthOptions>(
    configureBackend: BackendFactory<AuthOptions>
  ) {
    return configureBackend
  }
}
