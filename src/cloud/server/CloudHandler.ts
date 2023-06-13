import {fetch} from '@alinea/iso'
import {Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {Config, Connection} from 'alinea/core'
import {createError} from 'alinea/core/ErrorWithCode'
import {Outcome, OutcomeJSON} from 'alinea/core/Outcome'
import {CloudAuthServer} from './CloudAuthServer.js'
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

  constructor() {}

  publishChanges({changes}: Connection.ChangesParams, ctx: Connection.Context) {
    return fetch(
      cloudConfig.publish,
      withAuth(
        ctx,
        asJson({
          method: 'POST',
          body: JSON.stringify(changes)
        })
      )
    )
      .then(failOnHttpError)
      .then<void>(json)
  }

  async upload(
    {fileLocation, buffer}: Connection.MediaUploadParams,
    ctx: Connection.Context
  ): Promise<string> {
    return fetch(
      cloudConfig.media,
      withAuth(ctx, {
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

  async download(
    {location}: Connection.DownloadParams,
    ctx: Connection.Context
  ): Promise<Connection.Download> {
    return fetch(
      cloudConfig.media + '?' + new URLSearchParams({location}),
      withAuth(ctx)
    )
      .then(failOnHttpError)
      .then(async res => ({type: 'buffer', buffer: await res.arrayBuffer()}))
  }
}

export async function createCloudHandler(
  config: Config,
  store: Store,
  apiKey: string
) {
  const api = new CloudApi()
  return new Handler({
    auth: new CloudAuthServer({config, apiKey}),
    store,
    config,
    target: api,
    media: api,
    previews: new JWTPreviews(apiKey)
  })
}
