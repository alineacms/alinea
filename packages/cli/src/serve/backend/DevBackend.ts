import {JWTPreviews, Pages} from '@alinea/backend'
import {anonymousAuth, createRouter} from '@alinea/backend/Backend'
import {Handle} from '@alinea/backend/router/Router'
import {PreviewOptions} from '@alinea/backend/Server'
import {Client} from '@alinea/client'
import {Config, Outcome, WorkspaceConfig, Workspaces} from '@alinea/core'

export interface DevServerOptions<T extends Workspaces> {
  config: Config<T>
  serverLocation: string
}

export class DevBackend<T extends Workspaces = Workspaces> extends Client<T> {
  handle: Handle<Request, Response | undefined>
  previews = new JWTPreviews('@alinea/backend/devserver')

  constructor({config, serverLocation}: DevServerOptions<T>) {
    super(config, serverLocation)
    const api = createRouter<T>(this, anonymousAuth())
    const {handle} = api
    this.handle = handle
  }

  loadPages<K extends keyof T>(workspaceKey: K, options: PreviewOptions = {}) {
    const workspace = this.config.workspaces[workspaceKey]
    return new Pages<T[K] extends WorkspaceConfig<infer W> ? W : any>({
      workspace,
      query: cursor => {
        return this.query({
          cursor,
          source: !options?.preview && !options?.previewToken
        }).then(Outcome.unpack)
      }
    })
  }

  parsePreviewToken(token: string): Promise<{id: string; url: string}> {
    return this.previews.verify(token)
  }

  protected fetch(
    endpoint: string,
    init?: RequestInit | undefined
  ): Promise<Response> {
    return super.fetch(endpoint, init)
  }
}
