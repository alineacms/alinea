import {Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {History, Revision} from 'alinea/backend/History'
import {Store} from 'alinea/backend/Store'
import {Config, Connection, HttpError} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Outcome, OutcomeJSON} from 'alinea/core/Outcome'
import {CloudAuthServer} from './CloudAuthServer.js'
import {cloudConfig} from './CloudConfig.js'

async function failOnHttpError(res: Response): Promise<Response> {
  if (res.status >= 400) throw new HttpError(res.status, await res.text())
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

export class CloudApi implements Media, Target, History {
  canRename = false

  constructor() {}

  mutate({mutations}: Connection.MutateParams, ctx: Connection.Context) {
    return fetch(
      cloudConfig.mutate,
      withAuth(
        ctx,
        asJson({
          method: 'POST',
          body: JSON.stringify({mutations})
        })
      )
    )
      .then(failOnHttpError)
      .then<void>(json)
  }

  upload(
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

  download(
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

  delete(
    {location}: Connection.DeleteParams,
    ctx: Connection.Context
  ): Promise<void> {
    return fetch(
      cloudConfig.media + '?' + new URLSearchParams({location}),
      withAuth(ctx, {method: 'DELETE'})
    )
      .then(failOnHttpError)
      .then(() => undefined)
  }

  revisions(file: string, ctx: Connection.Context): Promise<Array<Revision>> {
    return fetch(
      cloudConfig.history + '?' + new URLSearchParams({file}),
      withAuth(ctx)
    )
      .then(failOnHttpError)
      .then<Array<Revision>>(json)
  }

  revisionData(
    file: string,
    revisionId: string,
    ctx: Connection.Context
  ): Promise<EntryRecord> {
    return fetch(
      cloudConfig.history +
        '?' +
        new URLSearchParams({file, revisionId, data: 'true'}),
      withAuth(ctx)
    )
      .then(failOnHttpError)
      .then<EntryRecord>(json)
  }
}

export function createCloudHandler(
  config: Config,
  store: Store,
  apiKey: string | undefined
) {
  const api = new CloudApi()
  return new Handler({
    auth: new CloudAuthServer({config, apiKey}),
    store,
    config,
    target: api,
    media: api,
    previews: new JWTPreviews(apiKey!)
  })
}
