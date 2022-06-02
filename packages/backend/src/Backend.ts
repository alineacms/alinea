import {Auth, Config, Workspaces} from '@alinea/core'
import {Store} from '@alinea/store/Store'
import {createFetchRouter} from './router/FetchRouter'
import {Handle, router} from './router/Router'
import {Server, ServerOptions} from './Server'

export type BackendOptions<T extends Workspaces> = {
  dashboardUrl: string
  auth?: Auth.Server
} & ServerOptions<T>

export class Backend<T extends Workspaces = Workspaces> extends Server<T> {
  handle: Handle<Request, Response>

  constructor(public options: BackendOptions<T>) {
    super(options)
    const api = createFetchRouter(this, options.dashboardUrl)
    const {handle} = options.auth ? router(options.auth.fetch, api) : api
    this.handle = handle
  }
}

export type BackendCreateOptions = {
  config: Config
  createStore: () => Promise<Store>
}

export type BackendFactory = (options: BackendCreateOptions) => Backend

export function backend(create: (options: BackendCreateOptions) => Backend) {
  return create
}
