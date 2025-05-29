//import {AbortController, type Response, fetch} from '@alinea/iso'
import {HandleAction} from 'alinea/backend/HandleAction'
import type {PreviewInfo} from 'alinea/backend/Previews'
import type {
  DraftTransport,
  LocalConnection,
  Revision
} from 'alinea/core/Connection'
import type {Config} from './Config.js'
import type {UploadResponse} from './Connection.js'
import type {Draft, DraftKey} from './Draft.js'
import type {EntryRecord} from './EntryRecord.js'
import type {AnyQueryResult, GraphQuery} from './Graph.js'
import {HttpError} from './HttpError.js'
import {getScope} from './Scope.js'
import type {User} from './User.js'
import type {CommitRequest} from './db/CommitRequest.js'
import type {Mutation} from './db/Mutation.js'
import {ReadonlyTree, type Tree} from './source/Tree.js'
import {base64} from './util/Encoding.js'

export type AuthenticateRequest = (
  request?: RequestInit
) => RequestInit | undefined

export interface ClientOptions {
  config: Config
  url: string
  applyAuth?: AuthenticateRequest
  unauthorized?: () => void
}

export class Client implements LocalConnection {
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

  prepareUpload(file: string): Promise<UploadResponse> {
    return this.#requestJson(
      {action: HandleAction.Upload},
      {
        method: 'POST',
        body: JSON.stringify({filename: file})
      }
    ).then<UploadResponse>(this.#failOnHttpError)
  }

  user(): Promise<User | undefined> {
    return this.#requestJson({action: HandleAction.User})
      .then<User | null>(this.#failOnHttpError)
      .then(user => user ?? undefined)
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const scope = getScope(this.#options.config)
    const body = scope.stringify(query)
    return this.#requestJson(
      {action: HandleAction.Resolve},
      {method: 'POST', body}
    ).then<AnyQueryResult<Query>>(this.#failOnHttpError)
  }

  mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.#requestJson(
      {action: HandleAction.Mutate},
      {method: 'POST', body: JSON.stringify(mutations)}
    ).then<{sha: string}>(this.#failOnHttpError)
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

  // Source

  getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    return this.#requestJson({
      action: HandleAction.Tree,
      sha
    })
      .then<Tree | null>(this.#failOnHttpError)
      .then(tree => (tree ? new ReadonlyTree(tree) : undefined))
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    if (shas.length === 0) return
    const response = await this.#request(
      {action: HandleAction.Blob},
      {
        method: 'POST',
        body: JSON.stringify({shas}),
        headers: {
          'content-type': 'application/json',
          accept: 'multipart/form-data'
        }
      }
    ).then(response => this.#failOnHttpError<Response>(response, false))
    const form = await response.formData()
    for (const [key, value] of form.entries()) {
      if (value instanceof Blob) {
        const sha = key.slice(0, 40)
        const blob = new Uint8Array(await value.arrayBuffer())
        yield [sha, blob]
      }
    }
  }

  // Commit

  write(request: CommitRequest): Promise<{sha: string}> {
    return this.#requestJson(
      {action: HandleAction.Commit},
      {method: 'POST', body: JSON.stringify(request)}
    ).then<{sha: string}>(this.#failOnHttpError)
  }

  // Drafts

  getDraft(key: DraftKey): Promise<Draft | undefined> {
    return this.#requestJson({action: HandleAction.Draft, key})
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
    params: {action: HandleAction; [key: string]: string},
    init?: RequestInit
  ): Promise<Response> {
    const {url, applyAuth = v => v, unauthorized} = this.#options
    const controller = new AbortController()
    const signal = controller.signal
    const location = `${url}?${new URLSearchParams(params).toString()}`

    const promise = fetch(location, {
      ...applyAuth(init),
      signal
    })
      .catch(err => {
        throw new HttpError(
          500,
          `${err} @ ${init?.method || 'GET'} action ${params.action}`
        )
      })
      .then(async res => {
        if (res.status === 401) unauthorized?.()
        if (!res.ok) {
          const isJson = res.headers
            .get('content-type')
            ?.includes('application/json')
          let errorMessage: string
          if (isJson) {
            const body = await res.json()
            if ('error' in body && typeof body.error === 'string')
              errorMessage = body.error
            else errorMessage = JSON.stringify(body, null, 2)
          } else {
            errorMessage = await res.text()
          }
          errorMessage = errorMessage.replace(/\s+/g, ' ').slice(0, 1024)
          throw new HttpError(
            res.status,
            `${errorMessage} @ ${init?.method || 'GET'} action ${params.action}`
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

  async #failOnHttpError<T = Response>(
    res: Response,
    expectJson = true
  ): Promise<T> {
    if (res.ok) return (expectJson ? res.json() : res) as T
    const text = await res.text()
    throw new HttpError(res.status, text || res.statusText)
  }
}
