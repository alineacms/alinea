import type {LocalConnection} from '#/core/Connection.js'
import {
  ActivityEvent,
  type Activity,
  type ActivityStatus
} from '#/core/db/ActivityEvent.js'
import type {LiveReplica} from './LiveReplica.js'
import type {
  PendingMutations,
  PendingMutationInput,
  PendingMutation,
  PendingScope
} from './PendingMutations.js'

export interface MutationQueueLock {
  <T>(name: string, run: () => Promise<T>, signal: AbortSignal): Promise<T>
}

export interface MutationQueueOptions {
  events?: EventTarget
  scope: PendingScope
  store: PendingMutations
  replica: Pick<LiveReplica, 'identity' | 'refreshAfterChange'>
  /** Authenticated client for exactly scope.endpoint. */
  client: Pick<LocalConnection, 'mutate'>
  lock?: MutationQueueLock
}

const browserLock: MutationQueueLock = (name, run, signal) => {
  if (!globalThis.navigator?.locks)
    return Promise.reject(new Error('Mutation queue requires Web Locks'))
  return navigator.locks.request(name, {signal}, run)
}

/** Owns its store, borrows its client/replica. Restore and enqueue never send.
 * Accepted intents remain durable until a post-write refresh succeeds. Unknown
 * outcomes retry the same ID and captured context through authority receipts.
 */
export class MutationQueue {
  readonly events: EventTarget
  #activities = new Map<string, Activity>()
  #options: MutationQueueOptions
  #abort = new AbortController()
  #operations = new Set<Promise<unknown>>()
  #accepted = new Map<string, {digest: string; sha: string}>()
  #flushing?: Promise<void>
  #closing?: Promise<void>

  constructor(options: MutationQueueOptions) {
    if (!options.store.matches(options.scope))
      throw new Error('Pending mutation scope does not match store')
    this.#options = {...options, scope: {...options.scope}}
    this.events = options.events ?? new EventTarget()
    this.#assertScope()
  }

  activities(): Array<Activity> {
    this.#assertScope()
    return structuredClone([...this.#activities.values()].reverse())
  }

  #record(row: PendingMutation, status: ActivityStatus, error?: unknown): void {
    if (this.#abort.signal.aborted) return
    try {
      this.#assertScope()
    } catch {
      return
    }
    const finished = ['succeeded', 'failed', 'discarded'].includes(status)
    this.#activities.set(row.id, {
      id: row.id,
      type: 'mutation',
      status,
      startedAt: row.createdAt,
      ...(finished ? {finishedAt: Date.now()} : {}),
      ...(error === undefined
        ? {}
        : {error: error instanceof Error ? error.message : String(error)}),
      operations: row.mutations.map(mutation => ({
        op: mutation.op,
        ...('id' in mutation ? {target: mutation.id} : {}),
        ...('locale' in mutation ? {locale: mutation.locale} : {}),
        ...('status' in mutation ? {status: mutation.status} : {})
      }))
    })
    this.#emit()
  }

  #emit(): void {
    const completed = [...this.#activities.values()].filter(item =>
      ['succeeded', 'discarded', 'cancelled'].includes(item.status)
    )
    for (const old of completed.slice(0, Math.max(0, completed.length - 100)))
      this.#activities.delete(old.id)
    this.events.dispatchEvent(
      new ActivityEvent(
        structuredClone([...this.#activities.values()].reverse())
      )
    )
  }

  /** Restore activity only; pending edits require an explicit retry. */
  restore(): Promise<void> {
    return this.#run(async () => {
      for (const row of await this.#options.store.list())
        this.#record(row, 'blocked')
    })
  }

  #assertScope(): void {
    this.#abort.signal.throwIfAborted()
    const {replica, scope} = this.#options
    const identity = replica.identity
    for (const key of ['project', 'namespace', 'epoch', 'principal'] as const)
      if (identity[key] !== scope[key])
        throw new Error('Pending mutation replica scope changed')
  }

  #run<T>(run: () => Promise<T>): Promise<T> {
    const {store, lock = browserLock} = this.#options
    const operation = Promise.resolve().then(() => {
      this.#assertScope()
      return lock(
        store.lockName,
        async () => {
          this.#assertScope()
          const result = await run()
          this.#assertScope()
          return result
        },
        this.#abort.signal
      )
    })
    this.#operations.add(operation)
    void operation
      .finally(() => this.#operations.delete(operation))
      .catch(() => {})
    return operation
  }

  enqueue(input: PendingMutationInput, options: {requireReady?: boolean} = {}) {
    // Snapshot before waiting for another tab's submission lock.
    const snapshot = structuredClone(input)
    const requireReady = options.requireReady
    return this.#run(async () => {
      if (
        requireReady &&
        [...this.#activities.values()].some(item =>
          ['failed', 'blocked'].includes(item.status)
        )
      )
        throw new Error(
          'Retry or discard pending edits before making more changes'
        )
      const row = await this.#options.store.enqueue(snapshot)
      this.#record(row, 'pending')
      return row
    })
  }

  list() {
    return this.#run(() => this.#options.store.list())
  }

  flush(): Promise<void> {
    if (this.#flushing) return this.#flushing
    const flushing = this.#run(async () => {
      const {store, client, replica, scope} = this.#options
      for (;;) {
        const [row, ...later] = await store.list()
        this.#assertScope()
        const present = new Set(
          [...(row ? [row] : []), ...later].map(item => item.id)
        )
        let removed = false
        for (const item of this.#activities.values()) {
          if (
            !present.has(item.id) &&
            ['blocked', 'pending', 'running', 'failed'].includes(item.status)
          ) {
            this.#activities.set(item.id, {
              ...item,
              status: 'cancelled',
              finishedAt: Date.now(),
              error: undefined
            })
            this.#accepted.delete(item.id)
            removed = true
          }
        }
        if (removed) this.#emit()
        if (!row) return
        for (const next of later) this.#record(next, 'blocked')
        this.#record(row, 'running')
        try {
          if (!row.acceptedSha) {
            let accepted = this.#accepted.get(row.id)
            if (accepted && accepted.digest !== row.digest)
              throw new Error('Pending mutation acceptance digest changed')
            if (!accepted) {
              const {sha} = await client.mutate(
                row.mutations,
                row.id,
                {
                  project: scope.project,
                  namespace: scope.namespace,
                  epoch: scope.epoch,
                  principal: scope.principal,
                  schemaId: row.schemaId,
                  configId: row.configId,
                  baseRevision: row.baseRevision
                },
                this.#abort.signal
              )
              this.#assertScope()
              accepted = {digest: row.digest, sha}
              this.#accepted.set(row.id, accepted)
            }
            await store.accept(row.id, row.digest, accepted.sha)
            this.#assertScope()
          }
          await replica.refreshAfterChange()
          this.#assertScope()
          await store.remove(row.id, row.digest)
          this.#accepted.delete(row.id)
          this.#record(row, 'succeeded')
        } catch (error) {
          this.#record(row, 'failed', error)
          throw error
        }
      }
    })
    this.#flushing = flushing
    void flushing
      .finally(() => {
        if (this.#flushing === flushing) this.#flushing = undefined
      })
      .catch(() => {})
    return flushing
  }

  /** Abandons local retry, not a possibly accepted authority-side mutation. */
  discard(id?: string): Promise<void> {
    return this.#run(async () => {
      const {store, replica} = this.#options
      const rows = (await store.list()).filter(
        row => id === undefined || row.id === id
      )
      this.#assertScope()
      if (!rows.length) return
      await replica.refreshAfterChange()
      this.#assertScope()
      for (const row of rows) {
        await store.remove(row.id, row.digest)
        this.#accepted.delete(row.id)
        this.#record(row, 'discarded')
      }
    })
  }

  /** Request purge on the first close; the borrowed replica is closed by its owner. */
  close(options: {purge?: boolean} = {}): Promise<void> {
    if (this.#closing) return this.#closing
    this.#abort.abort(new Error('Mutation queue is closed'))
    this.#closing = (async () => {
      await Promise.allSettled([...this.#operations])
      try {
        if (options.purge) await this.#options.store.purge()
      } finally {
        this.#accepted.clear()
        this.#activities.clear()
        this.#options.store.close()
      }
    })()
    return this.#closing
  }
}
