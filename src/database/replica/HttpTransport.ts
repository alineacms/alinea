import type {ByteRangeSource} from './Bundle.js'
import type {ReplicaCommand, ReplicaCommandResult} from './Commands.js'
import type {FieldTransaction, FieldTransactionResult} from './Operations.js'
import type {
  ReplicaBootstrap,
  ReplicaCursor,
  ReplicaTransport
} from './Protocol.js'
import {
  deserializeReplicaState,
  type SerializedReplicaState
} from './Serialization.js'
import type {ReplicaState} from './Types.js'

export interface HttpReplicaTransportOptions {
  handlerUrl: string | URL
  fetch?: typeof globalThis.fetch
}

export class HttpReplicaTransport implements ReplicaTransport {
  #handlerUrl: URL
  #fetch: typeof globalThis.fetch

  constructor(options: HttpReplicaTransportOptions) {
    this.#handlerUrl = new URL(
      options.handlerUrl,
      globalThis.location?.href ?? 'http://localhost'
    )
    this.#fetch = options.fetch ?? globalThis.fetch
  }

  bootstrap(): Promise<ReplicaBootstrap> {
    return this.#json('replicaBootstrap')
  }

  async state(
    cursor?: ReplicaCursor,
    signal?: AbortSignal
  ): Promise<ReplicaState | undefined> {
    const response = await this.#request('replicaState', {
      signal,
      params: cursor
        ? {revision: cursor.revision, view: cursor.viewId}
        : undefined
    })
    if (response.status === 204) return undefined
    await expectOk(response)
    return deserializeReplicaState(
      (await response.json()) as SerializedReplicaState
    )
  }

  mutate(
    transaction: FieldTransaction,
    signal?: AbortSignal
  ): Promise<FieldTransactionResult> {
    return this.#json('replicaMutate', {
      method: 'POST',
      signal,
      body: JSON.stringify(transaction)
    })
  }

  command(
    commands: ReadonlyArray<ReplicaCommand>,
    signal?: AbortSignal
  ): Promise<ReplicaCommandResult> {
    return this.#json('replicaCommand', {
      method: 'POST',
      signal,
      body: JSON.stringify(commands)
    })
  }

  eligible(query: string, signal?: AbortSignal): Promise<Array<string>> {
    return this.#json('replicaEligible', {
      method: 'POST',
      signal,
      body: query
    })
  }

  async #json<Result>(
    action: string,
    options: RequestOptions = {}
  ): Promise<Result> {
    const response = await this.#request(action, options)
    await expectOk(response)
    return response.json() as Promise<Result>
  }

  #request(action: string, options: RequestOptions = {}): Promise<Response> {
    const url = new URL(this.#handlerUrl)
    url.searchParams.set('action', action)
    for (const [key, value] of Object.entries(options.params ?? {}))
      url.searchParams.set(key, value)
    return this.#fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'include',
      signal: options.signal,
      headers: {
        accept: 'application/json',
        ...(options.body ? {'content-type': 'application/json'} : {})
      },
      body: options.body
    })
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  signal?: AbortSignal
  params?: Readonly<Record<string, string>>
  body?: string
}

export class HttpRangeSource implements ByteRangeSource {
  #url: URL
  #fetch: typeof globalThis.fetch

  constructor(url: string | URL, fetch = globalThis.fetch) {
    this.#url = new URL(url, globalThis.location?.href ?? 'http://localhost')
    this.#fetch = fetch
  }

  async read(
    offset: number,
    length: number,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const response = await this.#fetch(this.#url, {
      credentials: 'include',
      signal,
      headers: {range: `bytes=${offset}-${offset + length - 1}`}
    })
    await expectOk(response)
    const contents = new Uint8Array(await response.arrayBuffer())
    if (response.status === 206 || contents.length === length) return contents
    if (contents.length >= offset + length)
      return contents.slice(offset, offset + length)
    return contents
  }
}

async function expectOk(response: Response): Promise<void> {
  if (response.ok) return
  const message = await response.text()
  throw new Error(`Replica request failed (${response.status}): ${message}`)
}
