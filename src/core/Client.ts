import {AbortController, fetch, Response} from '@alinea/iso'
import {DraftTransport, Revision} from 'alinea/backend/Backend'
import {HandleAction} from 'alinea/backend/HandleAction'
import {PreviewInfo} from 'alinea/backend/Previews'
import {Connection, SyncResponse} from './Connection.js'
import {Draft} from './Draft.js'
import {EntryRecord} from './EntryRecord.js'
import {HttpError} from './HttpError.js'
import {Mutation} from './Mutation.js'
import {ResolveParams} from './Resolver.js'
import {User} from './User.js'
import {base64} from './util/Encoding.js'

export type AuthenticateRequest = (
  request?: RequestInit
) => RequestInit | undefined

export interface ClientOptions {
  url: string
  applyAuth?: AuthenticateRequest
  unauthorized?: () => void
}

export class Client implements Connection {
  #options: ClientOptions
  constructor(options: ClientOptions) {
    this.#options = options
  }

  get url() {
    return this.#options.url
  }

  previewToken(request: PreviewInfo): Promise<string> {
    return this.#requestJson(
      {action: HandleAction.PreviewToken},
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    ).then<string>(this.#failOnHttpError)
  }

  prepareUpload(file: string): Promise<Connection.UploadResponse> {
    return this.#requestJson(
      {action: HandleAction.Upload},
      {
        method: 'POST',
        body: JSON.stringify({filename: file})
      }
    ).then<Connection.UploadResponse>(this.#failOnHttpError)
  }

  user(): Promise<User | undefined> {
    return this.#requestJson({action: HandleAction.User})
      .then<User | null>(this.#failOnHttpError)
      .then(user => user ?? undefined)
  }

  resolve(params: ResolveParams): Promise<unknown> {
    const body = JSON.stringify(params)
    return this.#requestJson(
      {action: HandleAction.Resolve},
      {method: 'POST', body}
    ).then(this.#failOnHttpError)
  }

  mutate(mutations: Array<Mutation>): Promise<{commitHash: string}> {
    return this.#requestJson(
      {action: HandleAction.Mutate},
      {method: 'POST', body: JSON.stringify(mutations)}
    ).then<{commitHash: string}>(this.#failOnHttpError)
  }

  authenticate(applyAuth: AuthenticateRequest, unauthorized: () => void) {
    return new Client({...this.#options, applyAuth, unauthorized})
  }

  // History
  revisions(file: string): Promise<Array<Revision>> {
    return this.#requestJson({action: HandleAction.History, file}).then<
      Array<Revision>
    >(this.#failOnHttpError)
  }

  revisionData(
    file: string,
    revisionId: string
  ): Promise<EntryRecord | undefined> {
    return this.#requestJson({
      action: HandleAction.History,
      file,
      revisionId
    })
      .then<EntryRecord>(this.#failOnHttpError)
      .then(res => res ?? undefined)
  }

  // Syncable

  syncRequired(contentHash: string): Promise<boolean> {
    return this.#requestJson({
      action: HandleAction.Sync,
      contentHash
    }).then<boolean>(this.#failOnHttpError)
  }

  sync(contentHashes: Array<string>): Promise<SyncResponse> {
    return this.#requestJson(
      {action: HandleAction.Sync},
      {method: 'POST', body: JSON.stringify(contentHashes)}
    ).then<SyncResponse>(this.#failOnHttpError)
  }

  // Drafts

  getDraft(entryId: string): Promise<Draft | undefined> {
    return this.#requestJson({action: HandleAction.Draft, entryId})
      .then<DraftTransport | null>(this.#failOnHttpError)
      .then(draft =>
        draft ? {...draft, draft: base64.parse(draft.draft)} : undefined
      )
  }

  storeDraft(draft: Draft): Promise<void> {
    return this.#requestJson(
      {action: HandleAction.Draft},
      {
        method: 'POST',
        body: JSON.stringify({...draft, draft: base64.stringify(draft.draft)})
      }
    ).then<void>(res => this.#failOnHttpError(res, false))
  }

  #request(
    params: {action: HandleAction},
    init?: RequestInit
  ): Promise<Response> {
    const {url, applyAuth = v => v, unauthorized} = this.#options
    const controller = new AbortController()
    const signal = controller.signal
    const location = url + '?' + new URLSearchParams(params).toString()
    const promise = fetch(location, {
      ...applyAuth(init),
      signal
    })
      .catch(err => {
        throw new HttpError(
          500,
          `Could not ${init?.method || 'GET'} "${params.action}": ${err}`
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
            `Could not ${init?.method || 'GET'} "${params.action}" (${
              res.status
            }) ... ${msg.replace(/\s+/g, ' ').slice(0, 100)}`
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

  #requestJson<Params extends {action: HandleAction}>(
    params: Params,
    init?: RequestInit
  ) {
    return this.#request(params, {
      ...init,
      headers: {
        ...init?.headers,
        'content-type': 'application/json',
        accept: 'application/json'
      }
    })
  }

  async #failOnHttpError<T>(res: Response, expectJson = true): Promise<T> {
    if (res.ok) return expectJson ? res.json() : undefined
    const text = await res.text()
    throw new HttpError(res.status, text || res.statusText)
  }
}
