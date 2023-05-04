import {Request, Response} from '@alinea/iso'
import {JWTPreviews, Pages} from 'alinea/backend'
import {Backend, anonymousAuth, createRouter} from 'alinea/backend/Backend'
import {PreviewOptions} from 'alinea/backend/Server'
import {Handle} from 'alinea/backend/router/Router'
import {Client} from 'alinea/client'
import {Config, Hub, Outcome} from 'alinea/core'
import {Store} from 'alinea/store/Store'
import {DevData} from './DevData.js'
import {DevDrafts} from './DevDrafts.js'

export interface DevServerOptions {
  config: Config
  createStore: () => Promise<Store>
  serverLocation: string
}

class LocalBackend extends Backend {
  constructor({config, createStore, serverLocation}: DevServerOptions) {
    const drafts = new DevDrafts({
      serverLocation
    })
    const data = new DevData({
      serverLocation
    })
    super({
      dashboardUrl: serverLocation,
      createStore,
      config,
      drafts: drafts,
      media: data,
      target: data,
      previews: new JWTPreviews('@alinea/backend/devserver')
    })
  }
}

export class DevBackend<T> extends Client<T> {
  handle: Handle<Request, Response | undefined>
  previews = new JWTPreviews('@alinea/backend/devserver')
  local: LocalBackend
  fullyLocal = false

  constructor(options: DevServerOptions) {
    const {config, serverLocation = 'http://localhost:4500'} = options
    super(config, serverLocation)
    this.fullyLocal = options.serverLocation === undefined
    const api = createRouter<T>(this, anonymousAuth())
    const {handle} = api
    this.local = new LocalBackend({...options, serverLocation})
    this.handle = handle
  }

  fallback(method: keyof Hub<T>): any {
    return async (params: any) => {
      if (this.fullyLocal) return this.local[method](params)
      return super[method](params).then((outcome: Outcome<any>) => {
        if (outcome.isFailure() && outcome.status === 500)
          return this.local[method](params)
        return outcome
      })
    }
  }

  entry: Hub<T>['entry'] = this.fallback('entry')
  query: Hub<T>['query'] = this.fallback('query')
  updateDraft: Hub<T>['updateDraft'] = this.fallback('updateDraft')
  deleteDraft: Hub<T>['deleteDraft'] = this.fallback('deleteDraft')
  listDrafts: Hub<T>['listDrafts'] = this.fallback('listDrafts')
  uploadFile: Hub<T>['uploadFile'] = this.fallback('uploadFile')
  publishEntries: Hub<T>['publishEntries'] = this.fallback('publishEntries')

  loadPages(options: PreviewOptions = {}) {
    return new Pages<T>({
      schema: this.config.schema,
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
}
