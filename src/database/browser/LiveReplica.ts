import {Graph, type GraphQuery, type AnyQueryResult} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {getScope} from '#/core/Scope.js'
import type {QueryObserver} from '../runtime/EntryRuntime.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import {fetchBootstrap} from './FetchBootstrap.js'
import {ReplicaSession, type ConnectReplicaOptions} from './ReplicaSession.js'
import {ReplicaCache, type ReplicaIdentity} from './ReplicaCache.js'

interface Subscription {
  query: GraphQuery
  observer: QueryObserver
  sequence: number
}

/** Stable Graph/live-query facade over authenticated, immutable SQL generations. */
export class LiveReplica extends Graph {
  readonly config: ConnectReplicaOptions['config']
  #options: ConnectReplicaOptions
  #current?: ReplicaSession
  #candidate?: ReplicaSession
  #refreshing?: Promise<boolean>
  #subscriptions = new Set<Subscription>()
  #abort = new AbortController()
  #closed = false
  #closing?: Promise<void>
  #purging?: Promise<void>
  #identities = new Map<string, ReplicaIdentity>()

  private constructor(options: ConnectReplicaOptions) {
    super()
    this.config = options.config
    this.#options = {...options, expected: {...options.expected}}
  }

  static async connect(options: ConnectReplicaOptions): Promise<LiveReplica> {
    const replica = new LiveReplica(options)
    try {
      await replica.refresh(options.signal)
      return replica
    } catch (error) {
      await replica.close()
      throw error
    }
  }

  get bootstrap(): IndexBootstrap {
    if (this.#closed || !this.#current)
      throw new Error('Live replica is not ready')
    return this.#current.bootstrap
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    for (;;) {
      const session = this.#current
      if (this.#closed || !session) throw new Error('Live replica is not ready')
      try {
        const value = await session.resolve(query)
        if (!this.#closed && this.#current === session) return value
      } catch (error) {
        if (this.#current === session) throw error
      }
    }
  }

  subscribe(query: GraphQuery, observer: QueryObserver): () => void {
    if (this.#closed) throw new Error('Live replica is closed')
    const scope = getScope(this.config)
    const subscription = {
      query: scope.parse<GraphQuery>(scope.stringify(query)),
      observer,
      sequence: 0
    }
    this.#subscriptions.add(subscription)
    const sequence = subscription.sequence
    this.resolve(subscription.query).then(
      value => {
        if (sequence === subscription.sequence)
          this.#deliver(subscription, {status: 'fulfilled', value})
      },
      reason => {
        if (sequence === subscription.sequence)
          this.#deliver(subscription, {status: 'rejected', reason})
      }
    )
    return () => {
      subscription.sequence++
      this.#subscriptions.delete(subscription)
    }
  }

  #deliver(subscription: Subscription, result: PromiseSettledResult<unknown>) {
    if (this.#closed || !this.#subscriptions.has(subscription)) return
    try {
      if (result.status === 'fulfilled')
        subscription.observer.next(result.value)
      else subscription.observer.error(result.reason)
    } catch {
      // A faulty observer must not interrupt publication to other subscribers.
      subscription.sequence++
      this.#subscriptions.delete(subscription)
    }
  }

  async #invalidate(session: ReplicaSession, error: Error, purge: boolean) {
    const current = this.#current === session
    if (current) this.#current = undefined
    const closing = session.close(purge)
    try {
      if (current) {
        for (const subscription of this.#subscriptions) {
          subscription.sequence++
          this.#deliver(subscription, {status: 'rejected', reason: error})
        }
        this.#options.onInvalidated?.(error)
      }
    } finally {
      await closing
    }
  }

  /** Coalesces concurrent refreshes. The caller owns polling/push scheduling. */
  refresh(signal?: AbortSignal): Promise<boolean> {
    if (this.#closed) return Promise.reject(new Error('Live replica is closed'))
    if (!this.#refreshing) {
      const combined = signal
        ? AbortSignal.any([signal, this.#abort.signal])
        : this.#abort.signal
      this.#refreshing = this.#refresh(combined).finally(() => {
        this.#refreshing = undefined
      })
    }
    return this.#refreshing
  }

  async #refresh(signal: AbortSignal): Promise<boolean> {
    let next: ReplicaSession | undefined
    try {
      const view = await fetchBootstrap({...this.#options, signal})
      this.#identities.set(JSON.stringify(view.identity), view.identity)
      const previous = this.#current
      const sameIdentity =
        previous &&
        JSON.stringify(previous.identity) === JSON.stringify(view.identity)
      if (sameIdentity && previous.revision === view.revision) return false
      if (previous && !sameIdentity)
        await this.#invalidate(
          previous,
          new HttpError(409, 'Replica permission view changed'),
          true
        )
      next = await ReplicaSession.open({
        ...this.#options,
        bootstrap: view,
        signal,
        onInvalidated: error => {
          if (next)
            void this.#invalidate(
              next,
              error,
              !(error instanceof HttpError) || error.code !== 409
            ).catch(() => {})
        }
      })
      this.#candidate = next
      const prepared = new Map<Subscription, PromiseSettledResult<unknown>>()
      // Subscriptions added while a replacement loads must join its ready set.
      for (;;) {
        const missing = [...this.#subscriptions].filter(
          subscription => !prepared.has(subscription)
        )
        if (!missing.length) break
        const results = await Promise.allSettled(
          missing.map(subscription => next!.resolve(subscription.query))
        )
        for (let i = 0; i < missing.length; i++)
          prepared.set(missing[i], results[i])
      }
      signal.throwIfAborted()
      if (next.revision !== view.revision)
        throw new Error('Replacement replica revision mismatch')
      this.#current = next
      this.#candidate = undefined
      for (const [subscription, result] of prepared) {
        subscription.sequence++
        this.#deliver(subscription, result)
      }
      if (previous) await previous.close()
      return true
    } catch (error) {
      if (next && this.#current !== next) await next.close()
      if (
        error instanceof HttpError &&
        [401, 403].includes(error.code) &&
        this.#current
      )
        await this.#invalidate(this.#current, error, true)
      throw error
    } finally {
      this.#candidate = undefined
    }
  }

  close(purge = false): Promise<void> {
    if (!this.#closing) {
      this.#closed = true
      this.#abort.abort(new Error('Live replica closed'))
      this.#subscriptions.clear()
      const current = this.#current
      const candidate = this.#candidate
      this.#current = undefined
      this.#closing = (async () => {
        await Promise.all([
          current?.close(),
          candidate?.close(),
          this.#refreshing?.catch(() => {})
        ])
      })()
    }
    if (purge && !this.#purging) {
      this.#purging = this.#closing.then(async () => {
        if (this.#options.indexedDB) {
          for (const identity of this.#identities.values()) {
            const cache = await ReplicaCache.open(
              this.#options.indexedDB,
              identity
            )
            await cache.purge()
          }
        }
      })
    }
    return this.#purging ?? this.#closing
  }
}
