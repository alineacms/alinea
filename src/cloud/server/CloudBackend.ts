import {fetch} from '@alinea/iso'
import {JWTPreviews, Media, Server, Target} from 'alinea/backend'
import {Connection} from 'alinea/core'
import {BackendCreateOptions} from 'alinea/core/BackendConfig'
import {createError} from 'alinea/core/ErrorWithCode'
import {Outcome, OutcomeJSON} from 'alinea/core/Outcome'
import {CloudAuthServerOptions} from './CloudAuthServer.js'
import {cloudConfig} from './CloudConfig.js'

async function failOnHttpError(res: Response): Promise<Response> {
  if (res.status >= 400) throw createError(res.status, await res.text())
  return res
}

function json<T>(res: Response): Promise<T> {
  return res.json()
}

function withAuth(ctx: Connection.AuthContext, init: RequestInit = {}) {
  return {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${ctx.token}`
    }
  }
}

function asJson(init: RequestInit = {}) {
  return {
    ...init,
    headers: {
      ...init.headers,
      'content-type': 'application/json',
      accept: 'application/json'
    }
  }
}

export class CloudApi implements Media, Target {
  canRename = false

  constructor(private ctx: Connection.Context) {}

  auth() {
    return {
      authorization: `Bearer ${this.ctx.token!}`
    }
  }

  publishChanges({changes}: Connection.ChangesParams) {
    return fetch(
      cloudConfig.publish,
      withAuth(
        this.ctx,
        asJson({
          method: 'POST',
          body: JSON.stringify(changes)
        })
      )
    )
      .then(failOnHttpError)
      .then<void>(json)
  }

  async upload({
    fileLocation,
    buffer
  }: Connection.MediaUploadParams): Promise<string> {
    return fetch(
      cloudConfig.media,
      withAuth(this.ctx, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/octet-stream',
          'x-file-location': fileLocation
        },
        body: buffer
      })
    )
      .then(failOnHttpError)
      .then<OutcomeJSON<string>>(json)
      .then<Outcome<string>>(Outcome.fromJSON)
      .then(Outcome.unpack)
  }

  async download({
    location
  }: Connection.DownloadParams): Promise<Connection.Download> {
    return fetch(
      cloudConfig.media + '?' + new URLSearchParams({location}),
      withAuth(this.ctx)
    )
      .then(failOnHttpError)
      .then(async res => ({type: 'buffer', buffer: await res.arrayBuffer()}))
  }
}

export type CloudBackendOptions = BackendCreateOptions<CloudAuthServerOptions>

export class CloudBackend extends Server {
  constructor(options: CloudBackendOptions) {
    const apiKey = process.env.ALINEA_API_KEY
    const api = new CloudApi(options.config, apiKey)
    super({
      dashboardUrl: options.config.dashboard?.dashboardUrl!,
      config: options.config,
      createStore: options.createStore,
      auth: options.auth?.configure({apiKey, config: options.config}),
      drafts: api,
      target: api,
      media: api,
      previews: new JWTPreviews(apiKey!)
    })
  }
}
