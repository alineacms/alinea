import {AbortController, fetch, FormData, Response} from '@alinea/iso'
import {AlineaMeta} from 'alinea/backend/db/AlineaMeta'
import {
  Config,
  Connection,
  createError,
  Entry,
  EntryPhase,
  Media,
  Schema
} from 'alinea/core'
import {UpdateResponse} from './Connection.js'
import {Realm} from './pages/Realm.js'
import {serializeSelection} from './pages/Serialize.js'

async function failOnHttpError<T>(
  res: Response,
  expectJson = true
): Promise<T> {
  if (res.ok) return expectJson ? res.json() : undefined
  const text = await res.text()
  throw createError(res.status, text || res.statusText)
}

type AuthenticateRequest = (request?: RequestInit) => RequestInit | undefined

export interface ClientOptions {
  config: Config
  url: string
  applyAuth?: AuthenticateRequest
  unauthorized?: () => void
  resolveDefaults?: {
    realm?: Realm
    preview?: {
      entryId: string
      phase: EntryPhase
      update: string
    }
  }
}

export class Client implements Connection {
  targets: Schema.Targets

  constructor(public options: ClientOptions) {
    this.targets = Schema.targets(options.config.schema)
  }

  previewToken(): Promise<string> {
    return this.requestJson(Connection.routes.previewToken()).then<string>(
      failOnHttpError
    )
  }

  resolve(params: Connection.ResolveParams): Promise<unknown> {
    const {resolveDefaults} = this.options
    const {selection} = params
    serializeSelection(this.targets, selection)
    const body = JSON.stringify({...resolveDefaults, ...params})
    return this.requestJson(Connection.routes.resolve(), {
      method: 'POST',
      body
    }).then(failOnHttpError)
  }

  authenticate(applyAuth: AuthenticateRequest, unauthorized: () => void) {
    return new Client({...this.options, applyAuth, unauthorized})
  }

  updates(request: AlineaMeta): Promise<UpdateResponse> {
    const params = new URLSearchParams()
    params.append('contentHash', request.contentHash)
    params.append('modifiedAt', String(request.modifiedAt))
    return this.requestJson(
      Connection.routes.updates() + '?' + params.toString()
    ).then<UpdateResponse>(failOnHttpError)
  }

  versionIds(): Promise<Array<string>> {
    return this.requestJson(Connection.routes.versionIds()).then<Array<string>>(
      failOnHttpError
    )
  }

  saveDraft(entry: Entry): Promise<void> {
    return this.requestJson(Connection.routes.saveDraft(), {
      method: 'POST',
      body: JSON.stringify(entry)
    }).then<void>(res => failOnHttpError(res, false))
  }

  publishDrafts(entries: Array<Entry>): Promise<void> {
    return this.requestJson(Connection.routes.publishDrafts(), {
      method: 'POST',
      body: JSON.stringify(entries)
    }).then<void>(res => failOnHttpError(res, false))
  }

  uploadFile({
    workspace,
    root,
    ...file
  }: Connection.UploadParams): Promise<Media.File> {
    const form = new FormData()
    form.append('workspace', workspace as string)
    form.append('root', root as string)
    form.append('path', file.path)
    form.append('parentId', file.parentId || '')
    if (file.averageColor) form.append('averageColor', file.averageColor)
    if (file.blurHash) form.append('blurHash', file.blurHash)
    if ('width' in file) form.append('width', String(file.width))
    if ('height' in file) form.append('height', String(file.height))
    form.append('buffer', new Blob([file.buffer]))
    if (file.preview) form.append('preview', file.preview)
    return this.request(Connection.routes.upload(), {
      method: 'POST',
      body: form
    }).then<Media.File>(failOnHttpError)
  }

  protected request(endpoint: string, init?: RequestInit): Promise<Response> {
    const {url, applyAuth = v => v, unauthorized} = this.options
    const controller = new AbortController()
    const signal = controller.signal
    const location =
      url.endsWith('/') && endpoint.startsWith('/')
        ? url + endpoint.slice(1)
        : url + endpoint
    const promise = fetch(location, {
      ...applyAuth(init),
      signal
    })
      .catch(err => {
        throw createError(500, `Could not fetch "${endpoint}": ${err}`)
      })
      .then(async res => {
        if (res.status === 401) unauthorized?.()
        if (!res.ok) {
          const msg = await res.text()
          throw createError(
            res.status,
            `Could not fetch "${endpoint}" (${res.status}: ${msg})`
          )
        }
        return res
      })
    const cancel = () => controller.abort()
    function cancelify<T>(promise: Promise<T>) {
      const t = promise.then.bind(promise)
      const c = promise.catch.bind(promise)
      return Object.assign(promise, {
        cancel,
        then: (...args: any[]) => cancelify(t(...args)),
        catch: (...args: any[]) => cancelify(c(...args))
      })
    }
    return cancelify(promise)
  }

  protected requestJson(endpoint: string, init?: RequestInit) {
    return this.request(endpoint, {
      ...init,
      headers: {
        ...init?.headers,
        'content-type': 'application/json',
        accept: 'application/json'
      }
    })
  }
}
