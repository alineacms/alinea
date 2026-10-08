import type {CacheLocks} from '#/database/BrowserEntryStore.js'

/**
 * Exclusive Web Locks in memory, for runtimes without them. A lock whose
 * callback never settles stays held until `drop`, as when the worker that
 * holds it ends.
 */
export class FakeLocks implements CacheLocks {
  #held = new Set<string>()
  #waiting = new Map<string, Array<() => void>>()

  request(
    name: string,
    options: {ifAvailable?: boolean; signal?: AbortSignal},
    callback: (lock: Lock | null) => Promise<void> | void
  ): Promise<unknown> {
    if (!this.#held.has(name)) return this.#grant(name, callback)
    if (options.ifAvailable) return Promise.resolve(callback(null))
    return new Promise((resolve, reject) => {
      const waiting = this.#waiting.get(name) ?? []
      const grant = () => resolve(this.#grant(name, callback))
      waiting.push(grant)
      this.#waiting.set(name, waiting)
      options.signal?.addEventListener('abort', () => {
        waiting.splice(waiting.indexOf(grant), 1)
        reject(options.signal?.reason)
      })
    })
  }

  /** Free the lock `name`, and grant it to the next request waiting. */
  drop(name: string): void {
    this.#held.delete(name)
    this.#waiting.get(name)?.shift()?.()
  }

  async #grant(
    name: string,
    callback: (lock: Lock | null) => Promise<void> | void
  ): Promise<unknown> {
    this.#held.add(name)
    try {
      return await callback({name, mode: 'exclusive'})
    } finally {
      this.drop(name)
    }
  }
}
