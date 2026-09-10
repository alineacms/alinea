import type {LocalConnection} from '#/core/Connection.js'
import type {LiveReplica} from './LiveReplica.js'
import type {
  PendingMutations,
  PendingMutationInput,
  PendingScope
} from './PendingMutations.js'

export interface MutationQueueLock {
  <T>(name: string, run: () => Promise<T>, signal: AbortSignal): Promise<T>
}

export interface MutationQueueOptions {
  scope: PendingScope
  store: PendingMutations
  replica: Pick<LiveReplica, 'identity' | 'refreshAfterWrite'>
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
    this.#assertScope()
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

  enqueue(input: PendingMutationInput) {
    // Snapshot before waiting for another tab's submission lock.
    const snapshot = structuredClone(input)
    return this.#run(() => this.#options.store.enqueue(snapshot))
  }

  list() {
    return this.#run(() => this.#options.store.list())
  }

  flush(): Promise<void> {
    if (this.#flushing) return this.#flushing
    const flushing = this.#run(async () => {
      const {store, client, replica, scope} = this.#options
      for (;;) {
        const [row] = await store.list()
        this.#assertScope()
        if (!row) return
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
        await replica.refreshAfterWrite()
        this.#assertScope()
        await store.remove(row.id, row.digest)
        this.#accepted.delete(row.id)
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
  discard(id: string): Promise<void> {
    return this.#run(async () => {
      const {store, replica} = this.#options
      const row = (await store.list()).find(row => row.id === id)
      this.#assertScope()
      if (!row) return
      await replica.refreshAfterWrite()
      this.#assertScope()
      await store.remove(row.id, row.digest)
      this.#accepted.delete(row.id)
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
        this.#options.store.close()
      }
    })()
    return this.#closing
  }
}
