import {
  type Json,
  type MaybeJson,
  type Participant,
  SessionClient,
  type Shape,
  ShapeMismatchError
} from '@alinea/graft'
import type {Atom, WritableAtom} from 'jotai'
import type {SetStateAction} from 'react'

type Data = Record<string, unknown>

/** The parts of a jotai store a session reads and writes */
export interface LiveStore {
  get<Value>(atom: Atom<Value>): Value
  set<Value>(
    atom: WritableAtom<Value, [SetStateAction<Value>], void>,
    value: Value
  ): void
  sub(atom: Atom<unknown>, listener: () => void): () => void
}

export interface LiveSessionOptions {
  /** Where the handler serves sessions, `<handler>/session` */
  url: string
  headers?: HeadersInit
  fetch?(request: Request): Promise<Response>
  /** The ref the session starts from and saves to */
  branch: string
  /** The entry's file in the store's tree */
  path: string
  /** The shape of entry files, `Schema.shape` */
  shape: Shape
  store: LiveStore
  /** The form's value: the entry's fields */
  value: WritableAtom<Data, [SetStateAction<Data>], void>
  /** The entry's file holding fields, and the fields a file holds */
  toRecord(data: Data): Json
  fromRecord(record: Json, current: Data): Data
  /**
   * The shape of a newer schema, when the session was made by a deploy the
   * dashboard is behind; reloads the page by default
   */
  reload?(): Promise<Shape>
}

/**
 * Edits an entry together with whoever else is in its session: what the
 * form changes goes to the session, what others change comes into the form.
 * A session that closes, as after a deploy changed the schema, is followed
 * by a fresh one, which takes over the edits the closed one missed.
 */
export class LiveSession {
  #options: LiveSessionOptions
  #client: SessionClient
  #shape: Shape
  #participant: Participant | undefined
  #applied = ''
  #stop = new AbortController()
  #unsubscribe: (() => void) | undefined
  #running: Promise<void> | undefined

  constructor(options: LiveSessionOptions) {
    this.#options = options
    this.#shape = options.shape
    this.#client = new SessionClient({
      url: options.url,
      headers: options.headers,
      fetch: options.fetch
    })
  }

  /** Who else is in the session */
  get others(): Participant['others'] {
    return this.#participant?.others ?? []
  }

  /** Joins and keeps in sync until `stop` */
  async start(): Promise<void> {
    await this.#join()
    this.#unsubscribe = this.#options.store.sub(this.#options.value, () =>
      this.#edit()
    )
    this.#running = this.#run()
  }

  /** Sends what is left and leaves the session */
  async stop(): Promise<void> {
    this.#unsubscribe?.()
    this.#stop.abort()
    await this.#running?.catch(() => {})
    const participant = this.#participant
    if (participant && !participant.closed)
      await this.#client.leave(participant).catch(() => {})
  }

  /** Sends edits now, rather than with the next held request */
  async flush(): Promise<void> {
    if (this.#participant) await this.#client.sync(this.#participant)
  }

  async #join(carry?: MaybeJson): Promise<void> {
    const {branch, path} = this.#options
    let participant: Participant
    try {
      participant = await this.#client.join(this.#shape, {branch, path})
    } catch (error) {
      if (!(error instanceof ShapeMismatchError)) throw error
      this.#shape = await this.#reload()
      participant = await this.#client.join(this.#shape, {branch, path})
    }
    this.#participant = participant
    // What a closed session missed of this editor's edits carries over
    if (carry !== undefined) participant.edit(carry)
    this.#apply()
  }

  #reload(): Promise<Shape> {
    if (this.#options.reload) return this.#options.reload()
    globalThis.location?.reload()
    return new Promise(() => {})
  }

  async #run(): Promise<void> {
    const signal = this.#stop.signal
    while (!signal.aborted) {
      const participant = this.#participant!
      const closed = await this.#client
        .run(participant, {signal, onResponse: () => this.#apply()})
        .catch(error => {
          if (signal.aborted) return undefined
          throw error
        })
      if (!closed || signal.aborted) return
      await this.#join(participant.recovery()?.value)
      if (participant.recovery()) await this.flush()
    }
  }

  /** The form takes what the session holds when it differs */
  #apply(): void {
    const value = this.#participant?.value
    if (value === undefined) return
    const json = JSON.stringify(value)
    if (json === this.#applied) return
    this.#applied = json
    const {store, fromRecord} = this.#options
    const current = store.get(this.#options.value)
    store.set(this.#options.value, fromRecord(value as Json, current))
  }

  /** The session takes what the form changed */
  #edit(): void {
    const participant = this.#participant
    if (!participant || participant.closed) return
    const record = this.#options.toRecord(
      this.#options.store.get(this.#options.value)
    )
    const json = JSON.stringify(record)
    if (json === this.#applied) return
    this.#applied = json
    participant.edit(record)
    void this.#client.sync(participant).catch(() => {})
  }
}
