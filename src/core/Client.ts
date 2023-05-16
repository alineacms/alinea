import {AbortController, fetch, FormData, Response} from '@alinea/iso'
import {AlineaMeta} from 'alinea/backend/db/AlineaMeta'
import {Config, Connection, createError, Media} from 'alinea/core'
import {UpdateResponse} from './Connection.js'
import {Selection} from './pages/Selection.js'

async function failOnHttpError<T>(res: Response): Promise<T> {
  if (res.ok) return res.json()
  const text = await res.text()
  throw createError(res.status, text || res.statusText)
}

type AuthenticateRequest = (request?: RequestInit) => RequestInit | undefined

export class Client implements Connection {
  constructor(
    public config: Config,
    public url: string,
    protected applyAuth: AuthenticateRequest = v => v,
    protected unauthorized: () => void = () => {}
  ) {}

  resolve(selection: Selection): Promise<unknown> {
    const body = JSON.stringify(selection)
    return this.requestJson(Connection.routes.resolve(), {
      method: 'POST',
      body
    }).then(failOnHttpError)
  }

  authenticate(applyAuth: AuthenticateRequest, unauthorized: () => void) {
    return new Client(this.config, this.url, applyAuth, unauthorized)
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

  publishEntries({entries}: Connection.PublishParams): Promise<void> {
    return this.requestJson(Connection.routes.publish(), {
      method: 'POST',
      body: JSON.stringify(entries)
    }).then<void>(failOnHttpError)
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
    const controller = new AbortController()
    const signal = controller.signal
    const url =
      this.url.endsWith('/') && endpoint.startsWith('/')
        ? this.url + endpoint.slice(1)
        : this.url + endpoint
    const promise = fetch(url, {
      ...this.applyAuth(init),
      signal
    })
      .then(res => {
        if (res.status === 401) this.unauthorized()
        if (res.status > 400)
          throw createError(
            res.status,
            `Could not fetch "${endpoint}" (${res.status})`
          )
        return res
      })
      .catch(err => {
        throw createError(500, `Could not fetch "${endpoint}": ${err}`)
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
