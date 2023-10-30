import {Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {History, Revision} from 'alinea/backend/History'
import {Store} from 'alinea/backend/Store'
import {Config, Connection, HttpError, Workspace} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Outcome, OutcomeJSON} from 'alinea/core/Outcome'
import {join} from 'alinea/core/util/Paths'
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

  constructor(private config: Config) {}

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

  prepareUpload(
    file: string,
    ctx: Connection.Context
  ): Promise<Connection.UploadResponse> {
    return fetch(
      cloudConfig.upload,
      withAuth(
        ctx,
        asJson({
          method: 'POST',
          body: JSON.stringify({filename: file})
        })
      )
    )
      .then(failOnHttpError)
      .then<OutcomeJSON<Connection.UploadResponse>>(json)
      .then<Outcome<Connection.UploadResponse>>(Outcome.fromJSON)
      .then(Outcome.unpack)
  }

  delete(
    {location, workspace}: Connection.DeleteParams,
    ctx: Connection.Context
  ): Promise<void> {
    const mediaDir =
      Workspace.data(this.config.workspaces[workspace])?.mediaDir ?? ''
    const finalLocation = join(mediaDir, location)
    return fetch(
      cloudConfig.media + '?' + new URLSearchParams({location: finalLocation}),
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
      .then<OutcomeJSON<Array<Revision>>>(json)
      .then<Outcome<Array<Revision>>>(Outcome.fromJSON)
      .then(Outcome.unpack)
  }

  revisionData(
    file: string,
    ref: string,
    ctx: Connection.Context
  ): Promise<EntryRecord> {
    return fetch(
      cloudConfig.history + '?' + new URLSearchParams({file, ref}),
      withAuth(ctx)
    )
      .then(failOnHttpError)
      .then<OutcomeJSON<EntryRecord>>(json)
      .then<Outcome<EntryRecord>>(Outcome.fromJSON)
      .then(Outcome.unpack)
  }
}

export function createCloudHandler(
  config: Config,
  store: Store,
  apiKey: string | undefined
) {
  const api = new CloudApi(config)
  return new Handler({
    auth: new CloudAuthServer({config, apiKey}),
    store,
    config,
    target: api,
    media: api,
    history: api,
    previews: new JWTPreviews(apiKey!)
  })
}
