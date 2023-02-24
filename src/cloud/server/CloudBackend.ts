import {fetch} from '@alinea/iso'
import {Backend, Data, Drafts, JWTPreviews} from 'alinea/backend'
import {BackendCreateOptions} from 'alinea/core/BackendConfig'
import {Config} from 'alinea/core/Config'
import {createError} from 'alinea/core/ErrorWithCode'
import {Hub} from 'alinea/core/Hub'
import {Outcome, OutcomeJSON} from 'alinea/core/Outcome'
import {base64, base64url} from 'alinea/core/util/Encoding'
import {CloudAuthServerOptions} from './CloudAuthServer.js'
import {cloudConfig} from './CloudConfig.js'

export interface CloudConnection extends Drafts, Data.Media, Data.Target {}

async function failOnHttpError(res: Response): Promise<Response> {
  if (res.status >= 400) throw createError(res.status, await res.text())
  return res
}

function json<T>(res: Response): Promise<T> {
  return res.json()
}

function withAuth(ctx: Hub.AuthContext, init: RequestInit = {}) {
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

export class CloudApi implements CloudConnection {
  canRename = false

  constructor(private config: Config, private apiKey: string | undefined) {}

  auth(ctx: Hub.Context) {
    return {
      authorization: `Bearer ${ctx.token!}`
    }
  }

  publish({changes}: Hub.ChangesParams, ctx: Hub.Context) {
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
    {fileLocation, buffer}: Hub.MediaUploadParams,
    ctx: Hub.Context
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
    {location}: Hub.DownloadParams,
    ctx: Hub.Context
  ): Promise<Hub.Download> {
    return fetch(
      cloudConfig.media + '?' + new URLSearchParams({location}),
      withAuth(ctx)
    )
      .then(failOnHttpError)
      .then(async res => ({type: 'buffer', buffer: await res.arrayBuffer()}))
  }
  get(
    {id, stateVector}: Hub.EntryParams,
    ctx: Hub.Context
  ): Promise<Uint8Array | undefined> {
    const params = stateVector
      ? '?' +
        new URLSearchParams({stateVector: base64url.stringify(stateVector)})
      : ''
    // We use the api key to fetch a draft here which was requested during
    // previewing. The preview token has been validated in Server.loadPages.
    const token = ctx.preview ? this.apiKey : ctx.token
    return fetch(cloudConfig.draft + `/${id}` + params, withAuth({token})).then(
      res => {
        if (res.status === 404) return undefined
        return failOnHttpError(res)
          .then(res => res.arrayBuffer())
          .then(buffer => new Uint8Array(buffer))
      }
    )
  }
  update(
    {id, update}: Hub.UpdateParams,
    ctx: Hub.Context
  ): Promise<Drafts.Update> {
    return fetch(
      cloudConfig.draft + `/${id}`,
      withAuth(ctx, {
        method: 'PUT',
        headers: {'content-type': 'application/octet-stream'},
        body: update
      })
    )
      .then(failOnHttpError)
      .then(() => ({id, update}))
  }
  delete({ids}: Hub.DeleteMultipleParams, ctx: Hub.Context): Promise<void> {
    return fetch(
      cloudConfig.draft,
      asJson(withAuth(ctx, {method: 'DELETE', body: JSON.stringify({ids})}))
    )
      .then(failOnHttpError)
      .then(() => void 0)
  }
  async *updates({}, ctx: Hub.Context): AsyncGenerator<Drafts.Update> {
    // We use the api key to fetch a draft here which was requested during
    // previewing. The preview token has been validated in Server.loadPages.
    const token = ctx.preview ? this.apiKey : ctx.token
    const updates = await fetch(cloudConfig.draft, asJson(withAuth({token})))
      .then(failOnHttpError)
      .then<{
        success: boolean
        data: Array<{
          id: string
          update: string
        }>
      }>(json)

    for (const update of updates.data) {
      yield {
        id: update.id,
        update: base64.parse(update.update)
      }
    }
  }
}

export type CloudBackendOptions = BackendCreateOptions<CloudAuthServerOptions>

export class CloudBackend extends Backend {
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
