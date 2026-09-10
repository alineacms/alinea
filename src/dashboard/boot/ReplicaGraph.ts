import type {Config} from '#/core/Config.js'
import {GraphSessionAbort} from '#/core/db/GraphSession.js'
import type {User} from '#/core/User.js'
import type {GraphQuery, AnyQueryResult} from '#/core/Graph.js'
import type {Policy} from '#/core/Role.js'
import type {UploadMetadata, UploadResponse} from '#/core/Connection.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {MutationContext} from '#/core/db/MutationContext.js'
import type {EntryReferenceQuery} from '#/core/db/EntryReference.js'
import {WritableGraph} from '#/core/db/WritableGraph.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {ActivityEvent, type Activity} from '#/core/db/ActivityEvent.js'
import type {QueryObserver} from '#/database/runtime/EntryRuntime.js'

export interface ReplicaGraphSession extends WritableGraph {
  subscribe(
    query: GraphQuery,
    observer: QueryObserver
  ): (() => void) | Promise<() => void | Promise<void>>
  events: EventTarget
  sha: string | Promise<string>
  sync(): Promise<string>
  compiledPolicy(): Promise<Policy>
  activities(): Promise<Array<Activity>>
  retryActivity(): Promise<void>
  discardActivity(): Promise<void>
  close(purge?: boolean): Promise<void>
}

export interface ReplicaGraphOptions {
  config: Config
  /** Must bind the verified principal to the generated project/namespace and endpoint. */
  connect(principal: string, signal: AbortSignal): Promise<ReplicaGraphSession>
  pollInterval?: number
}

/** Authentication-scoped dashboard facade. No database opens before authenticate.
 * Each connection owns its event bridges; replacement never borrows the prior
 * user's ready state or resumes their pending edits.
 */
export class ReplicaGraph extends WritableGraph {
  readonly config: Config
  readonly events = new EventTarget()
  #options: ReplicaGraphOptions
  #session?: ReplicaGraphSession
  #principal?: string
  #connecting?: Promise<void>
  #cancel?: (purge: boolean) => void
  #generation = 0
  #timer?: ReturnType<typeof setTimeout>
  #stop?: () => void
  #retiring: Promise<void> = Promise.resolve()
  #closed = false
  #subscriptions = new Set<() => Promise<void>>()

  constructor(options: ReplicaGraphOptions) {
    super()
    const interval = options.pollInterval ?? 120_000
    if (!Number.isFinite(interval) || interval < 0)
      throw new Error('Invalid replica polling interval')
    this.config = options.config
    this.#options = {...options, pollInterval: interval}
  }

  authenticate(user: User): Promise<void> {
    if (this.#closed)
      return Promise.reject(new Error('Dashboard replica is closed'))
    if (!user.sub) return Promise.reject(new Error('Missing replica principal'))
    if (user.sub === this.#principal)
      return this.#connecting ?? Promise.resolve()
    const retiring = this.disconnect(true)
    const generation = this.#generation
    const abort = new AbortController()
    let purgeCancelled = false
    this.#cancel = purge => {
      purgeCancelled = purge
      abort.abort(new GraphSessionAbort(purge))
    }
    this.#principal = user.sub
    const connecting = (async () => {
      await retiring
      abort.signal.throwIfAborted()
      const session = await this.#options.connect(user.sub, abort.signal)
      if (this.#closed || generation !== this.#generation) {
        await session.close(purgeCancelled)
        throw new Error('Dashboard replica connection superseded')
      }
      this.#session = session
      const listen = (event: Event) => {
        if (this.#session !== session) return
        if (event instanceof IndexEvent)
          this.events.dispatchEvent(new IndexEvent(event.data))
        if (event instanceof ActivityEvent)
          this.events.dispatchEvent(new ActivityEvent(event.activities))
      }
      session.events.addEventListener(IndexEvent.type, listen)
      session.events.addEventListener(ActivityEvent.type, listen)
      this.#stop = () => {
        session.events.removeEventListener(IndexEvent.type, listen)
        session.events.removeEventListener(ActivityEvent.type, listen)
      }
      const sha = await session.sha
      if (this.#session !== session)
        throw new Error('Dashboard replica connection superseded')
      this.events.dispatchEvent(new IndexEvent({op: 'index', sha, ids: []}))
      this.#poll(generation)
    })()
    this.#connecting = connecting
    void connecting
      .catch(() => {
        if (generation === this.#generation) {
          this.#principal = undefined
          void this.disconnect(true).catch(() => {})
        }
      })
      .finally(() => {
        if (this.#connecting === connecting) this.#connecting = undefined
      })
    return connecting
  }

  #ready(): ReplicaGraphSession {
    if (this.#closed || !this.#session)
      throw new Error('Dashboard replica is not authenticated')
    return this.#session
  }

  async #read<T>(
    read: (session: ReplicaGraphSession) => T | Promise<T>
  ): Promise<T> {
    const session = this.#ready()
    const result = await read(session)
    if (this.#session !== session)
      throw new Error('Dashboard replica session changed')
    return result
  }

  #poll(generation: number): void {
    if (
      !this.#options.pollInterval ||
      generation !== this.#generation ||
      this.#closed
    )
      return
    this.#timer = setTimeout(() => {
      void this.sync()
        .catch(() => {})
        .finally(() => this.#poll(generation))
    }, this.#options.pollInterval)
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.#read(session => session.resolve(query))
  }

  async subscribe(
    query: GraphQuery,
    observer: QueryObserver
  ): Promise<() => Promise<void>> {
    const session = this.#ready()
    let active = true
    const unsubscribe = await session.subscribe(query, {
      next: value => {
        if (active && this.#session === session) observer.next(value)
      },
      error: error => {
        if (active && this.#session === session) observer.error(error)
      }
    })
    const stop = async () => {
      if (!active) return
      active = false
      this.#subscriptions.delete(stop)
      await unsubscribe()
    }
    if (this.#session !== session) {
      await stop()
      throw new Error('Dashboard replica session changed')
    }
    this.#subscriptions.add(stop)
    return stop
  }
  mutate(mutations: Array<Mutation>, expected?: MutationContext) {
    return this.#read(session => session.mutate(mutations, expected))
  }
  mutationContext() {
    return this.#read(session => session.mutationContext())
  }
  referencesTo(query: EntryReferenceQuery) {
    return this.#read(session => session.referencesTo(query))
  }
  prepareUpload(
    file: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    return this.#read(session => session.prepareUpload(file, metadata))
  }
  compiledPolicy() {
    return this.#read(session => session.compiledPolicy())
  }
  get sha() {
    return this.#read(session => session.sha)
  }
  sync() {
    return this.#read(session => session.sync())
  }
  activities(): Promise<Array<Activity>> {
    return this.#session
      ? this.#read(session => session.activities())
      : Promise.resolve([])
  }
  retryActivity() {
    return this.#read(session => session.retryActivity())
  }
  discardActivity() {
    return this.#read(session => session.discardActivity())
  }

  disconnect(purge = true): Promise<void> {
    this.#generation++
    this.#principal = undefined
    this.#cancel?.(purge)
    const connecting = this.#connecting
    this.#connecting = undefined
    clearTimeout(this.#timer)
    this.#stop?.()
    this.#stop = undefined
    const session = this.#session
    this.#session = undefined
    if (session)
      this.events.dispatchEvent(
        new IndexEvent({
          op: 'invalidate',
          error: new Error('Dashboard replica disconnected')
        })
      )
    const closing = session?.close(purge) ?? Promise.resolve()
    const subscriptions = Promise.all(
      [...this.#subscriptions].map(stop => stop())
    )
    this.#retiring = Promise.all([
      this.#retiring,
      closing,
      subscriptions,
      connecting?.catch(() => {})
    ]).then(() => {})
    return this.#retiring
  }

  close(purge = false): Promise<void> {
    this.#closed = true
    return this.disconnect(purge)
  }
}
