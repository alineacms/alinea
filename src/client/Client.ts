import {AbortController, fetch, FormData, Response} from '@alinea/iso'
import {
  Config,
  Connection,
  createError,
  Entry,
  Future,
  Media,
  Outcome
} from 'alinea/core'

async function toFuture<T = void>(res: Response): Future<T> {
  return Outcome.fromJSON<T>(await res.json())
}

function fail(err: Error): any {
  return Outcome.Failure(err)
}

type AuthenticateRequest = (request?: RequestInit) => RequestInit | undefined

export class Client implements Connection {
  constructor(
    public config: Config,
    public url: string,
    protected applyAuth: AuthenticateRequest = v => v,
    protected unauthorized: () => void = () => {}
  ) {}

  authenticate(applyAuth: AuthenticateRequest, unauthorized: () => void) {
    return new Client(this.config, this.url, applyAuth, unauthorized)
  }

  entry({
    id,
    stateVector
  }: Connection.EntryParams): Future<Entry.Detail | null> {
    return this.requestJson(Connection.routes.entry(id, stateVector), {
      method: 'GET'
    }).then<Outcome<Entry.Detail | null>>(toFuture, fail)
  }

  query<T>({cursor, source}: Connection.QueryParams<T>): Future<Array<T>> {
    const params = source ? '?source' : ''
    return this.requestJson(Connection.routes.query() + params, {
      method: 'POST',
      body: JSON.stringify(cursor.toJSON())
    }).then<Outcome<Array<T>>>(toFuture, fail)
  }

  updateDraft({id, update}: Connection.UpdateParams): Future {
    return this.request(Connection.routes.draft(id), {
      method: 'PUT',
      headers: {'content-type': 'application/octet-stream'},
      body: update
    }).then(toFuture)
  }

  deleteDraft({id}: Connection.DeleteParams): Future<boolean> {
    return this.request(Connection.routes.draft(id), {
      method: 'DELETE'
    }).then<Outcome<boolean>>(toFuture, fail)
  }

  listDrafts({workspace}: Connection.ListParams): Future<Array<{id: string}>> {
    return this.request(
      Connection.routes.drafts() + `?workspace=${workspace}`,
      {
        method: 'GET'
      }
    ).then<Outcome<Array<{id: string}>>>(toFuture, fail)
  }

  publishEntries({entries}: Connection.PublishParams): Future {
    return this.requestJson(Connection.routes.publish(), {
      method: 'POST',
      body: JSON.stringify(entries)
    }).then(toFuture, fail)
  }

  uploadFile({
    workspace,
    root,
    ...file
  }: Connection.UploadParams): Future<Media.File> {
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
    }).then<Outcome<Media.File>>(toFuture, fail)
  }

  /*listFiles(location?: string): Future<Array<Hub.DirEntry>> {
    return this.request(Hub.routes.files(location), {
      method: 'GET'
    }).then<Outcome<Array<Hub.DirEntry>>>(toFuture)
  }*/

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
