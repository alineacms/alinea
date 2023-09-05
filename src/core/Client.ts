import {AbortController, fetch, FormData, Response} from '@alinea/iso'
import {AlineaMeta} from 'alinea/backend/db/AlineaMeta'
import {Media} from 'alinea/backend/Media'
import {Config, Connection, EntryPhase, HttpError} from 'alinea/core'
import {UpdateResponse} from './Connection.js'
import {Mutation} from './Mutation.js'
import {Realm} from './pages/Realm.js'

async function failOnHttpError<T>(
  res: Response,
  expectJson = true
): Promise<T> {
  if (res.ok) return expectJson ? res.json() : undefined
  const text = await res.text()
  throw new HttpError(res.status, text || res.statusText)
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
  constructor(public options: ClientOptions) {}

  previewToken(): Promise<string> {
    return this.requestJson(Connection.routes.previewToken()).then<string>(
      failOnHttpError
    )
  }

  resolve(params: Connection.ResolveParams): Promise<unknown> {
    const {resolveDefaults} = this.options
    const body = JSON.stringify({...resolveDefaults, ...params})
    return this.requestJson(Connection.routes.resolve(), {
      method: 'POST',
      body
    }).then(failOnHttpError)
  }

  mutate(mutations: Array<Mutation>): Promise<void> {
    return this.requestJson(Connection.routes.mutate(), {
      method: 'POST',
      body: JSON.stringify(mutations)
    }).then<void>(res => failOnHttpError(res, false))
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

  async deleteFile(entryId: string): Promise<void> {}

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
    if (file.thumbHash) form.append('thumbHash', file.thumbHash)
    if ('width' in file) form.append('width', String(file.width))
    if ('height' in file) form.append('height', String(file.height))
    form.append('buffer', new Blob([file.buffer]))
    if (file.preview) form.append('preview', file.preview)
    return this.request(Connection.routes.media(), {
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
        throw new HttpError(
          500,
          `❌ ${init?.method || 'GET'} "${endpoint}": ${err}`
        )
      })
      .then(async res => {
        if (res.status === 401) unauthorized?.()
        if (!res.ok) {
          const isJson = res.headers
            .get('content-type')
            ?.includes('application/json')
          const msg = isJson
            ? JSON.stringify(await res.json(), null, 2)
            : await res.text()
          throw new HttpError(
            res.status,
            `❌ ${init?.method || 'GET'} "${endpoint}" (${res.status})\n${msg}`
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
