import {Backend, Data, Drafts, JsonLoader, JWTPreviews} from '@alinea/backend'
import {Storage} from '@alinea/backend/Storage'
import {BackendCreateOptions} from '@alinea/core/BackendConfig'
import {Config} from '@alinea/core/Config'
import {Entry} from '@alinea/core/Entry'
import {Store} from '@alinea/store/Store'
import {CloudAuthServerOptions} from './CloudAuthServer'

class CloudApi implements Drafts, Data.Media, Data.Media, Data.Target {
  constructor(private config: Config, private apiKey: string | undefined) {}
  async publish(current: Store, entries: Array<Entry>): Promise<void> {
    const {config} = this
    const changes = await Storage.publishChanges(
      config,
      current,
      JsonLoader,
      entries,
      false
    )
    console.log('Publish changes: ')
    console.log(changes)
  }
  upload(workspace: string, file: Data.Media.Upload): Promise<string> {
    throw new Error('Method not implemented.')
  }
  download(workspace: string, location: string): Promise<Data.Media.Download> {
    throw new Error('Method not implemented.')
  }
  async get(
    id: string,
    stateVector?: Uint8Array | undefined
  ): Promise<Uint8Array | undefined> {
    return undefined
  }
  async update(id: string, update: Uint8Array): Promise<Drafts.Update> {
    return {id, update}
  }
  async delete(ids: string[]): Promise<void> {}
  async *updates(): AsyncGenerator<Drafts.Update, any, unknown> {}
}

export type CloudBackendOptions = BackendCreateOptions<CloudAuthServerOptions>

export class CloudBackend extends Backend {
  constructor(options: CloudBackendOptions) {
    const apiKey = 'abc' // process.env.ALINEA_API_KEY
    const api = new CloudApi(options.config, apiKey)
    super({
      dashboardUrl: undefined!,
      config: options.config,
      createStore: options.createStore,
      auth: options.auth.configure({apiKey}),
      drafts: api,
      target: api,
      media: api,
      previews: new JWTPreviews(apiKey!)
    })
  }
}
