import {Database, Handler, JWTPreviews} from 'alinea/backend'
import {Backend} from 'alinea/backend/Backend'
import {Revision} from 'alinea/backend/History'
import {ChangeSet} from 'alinea/backend/data/ChangeSet'
import {Config} from 'alinea/core/Config'
import {Connection} from 'alinea/core/Connection'
import {Draft} from 'alinea/core/Draft'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {HttpError} from 'alinea/core/HttpError'
import {Mutation} from 'alinea/core/Mutation'
import {Outcome, OutcomeJSON} from 'alinea/core/Outcome'
import {base64} from 'alinea/core/util/Encoding'
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

export class CloudApi implements Backend {
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
      .then<OutcomeJSON<{commitHash: string}>>(json)
      .then<Outcome<{commitHash: string}>>(Outcome.fromJSON)
      .then(Outcome.unpack)
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
    commitHash: string,
    ctx: Connection.Context
  ): Promise<{toCommitHash: string; mutations: Array<Mutation>} | undefined> {
    return fetch(
      cloudConfig.pending + '?' + new URLSearchParams({since: commitHash}),
      withAuth(ctx)
    )
      .then(failOnHttpError)
      .then<OutcomeJSON<Array<{commitHashTo: string; mutations: ChangeSet}>>>(
        json
      )
      .then<Outcome<Array<{commitHashTo: string; mutations: ChangeSet}>>>(
        Outcome.fromJSON
      )
      .then(Outcome.unpack)
      .then(pending => {
        if (pending.length === 0) return undefined
        return {
          toCommitHash: pending[pending.length - 1].commitHashTo,
          mutations: pending.flatMap(mutate =>
            mutate.mutations.flatMap(m => m.meta)
          )
        }
      })
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
          method: 'PUT',
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
    type CloudDraft = {fileHash: string; update: string; commitHash: string}
    return fetch(cloudConfig.drafts + '/' + entryId, withAuth(ctx))
      .then(failOnHttpError)
      .then<OutcomeJSON<CloudDraft | null>>(json)
      .then<Outcome<CloudDraft | null>>(Outcome.fromJSON)
      .then(Outcome.unpack)
      .then(data => {
        return data
          ? {
              entryId,
              commitHash: data.commitHash,
              fileHash: data.fileHash,
              draft: base64.parse(data.update)
            }
          : undefined
      })
  }
}

export function createCloudHandler(
  config: Config,
  db: Database,
  apiKey: string | undefined
) {
  const api = apiKey ? new CloudApi(config) : undefined
  return new Handler({
    auth: new CloudAuthServer({config, apiKey}),
    db,
    config,
    target: api,
    media: api,
    history: api,
    pending: api,
    drafts: api,
    previews: new JWTPreviews(apiKey!),
    previewAuthToken: apiKey!
  })
}
