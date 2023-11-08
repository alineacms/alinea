import {Database, Handler, JWTPreviews, Media, Target} from 'alinea/backend'
import {Drafts} from 'alinea/backend/Drafts'
import {History, Revision} from 'alinea/backend/History'
import {Pending} from 'alinea/backend/Pending'
import {Config, Connection, Draft, HttpError, Workspace} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {Mutation} from 'alinea/core/Mutation'
import {Outcome, OutcomeJSON} from 'alinea/core/Outcome'
import {base64} from 'alinea/core/util/Encoding'
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

export class CloudApi implements Media, Target, History, Pending, Drafts {
  constructor(private config: Config) {}

  mutate(params: Connection.MutateParams, ctx: Connection.Context) {
    return fetch(
      cloudConfig.mutate,
      withAuth(
        ctx,
        asJson({
          method: 'POST',
          body: JSON.stringify(params)
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

  deleteUpload(
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

  pendingSince(
    contentHash: string,
    ctx: Connection.Context
  ): Promise<Array<Mutation>> {
    return fetch(
      cloudConfig.pending + '?' + new URLSearchParams({since: contentHash}),
      withAuth(ctx)
    )
      .then(failOnHttpError)
      .then<OutcomeJSON<Array<Connection.MutateParams>>>(json)
      .then<Outcome<Array<Connection.MutateParams>>>(Outcome.fromJSON)
      .then(Outcome.unpack)
      .then(mutations =>
        mutations.flatMap(mutate => mutate.mutations.flatMap(m => m.meta))
      )
  }

  storeDraft(draft: Draft, ctx: Connection.Context): Promise<void> {
    const body = {
      fileHash: draft.fileHash,
      update: base64.stringify(draft.draft)
    }
    return fetch(
      cloudConfig.drafts + '/' + draft.entryId,
      withAuth(
        ctx,
        asJson({
          method: 'POST',
          body: JSON.stringify(body)
        })
      )
    )
      .then(failOnHttpError)
      .then(() => undefined)
  }

  getDraft(
    entryId: string,
    ctx: Connection.Context
  ): Promise<Draft | undefined> {
    return fetch(cloudConfig.drafts + '/' + entryId, withAuth(ctx))
      .then(failOnHttpError)
      .then<OutcomeJSON<{fileHash: string; update: string}>>(json)
      .then<Outcome<{fileHash: string; update: string}>>(Outcome.fromJSON)
      .then(Outcome.unpack)
      .then(({fileHash, update}) => ({
        entryId,
        fileHash,
        draft: base64.parse(update)
      }))
  }
}

export function createCloudHandler(
  config: Config,
  db: Database,
  apiKey: string | undefined
) {
  const api = new CloudApi(config)
  return new Handler({
    auth: new CloudAuthServer({config, apiKey}),
    db,
    config,
    target: api,
    media: api,
    history: api,
    pending: api,
    drafts: api,
    previews: new JWTPreviews(apiKey!)
  })
}
