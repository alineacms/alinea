import {isRecord} from '#/core/util/Objects.js'

/** Keep the latest requested revision while configuration imports/rendering yield. */
export class DevConfigUpdates {
  #source: EventTarget
  #revision: string
  #pending?: string
  #waiting?: ReturnType<typeof Promise.withResolvers<string>>
  #reload?: () => void
  #closed = false
  #receive = (event: Event) => {
    if (!('data' in event) || typeof event.data !== 'string') return
    let info: unknown
    try {
      info = JSON.parse(event.data)
    } catch {
      return
    }
    if (!isRecord(info)) return
    switch (info.type) {
      case 'refresh':
      case 'reload':
        if (typeof info.revision !== 'string' || !info.revision) return
        if (info.type === 'reload' && this.#reload) return this.#reload()
        this.#revision = info.revision
        break
      case 'refetch':
        break
      default:
        return
    }
    if (this.#waiting) {
      this.#waiting.resolve(this.#revision)
      this.#waiting = undefined
    } else this.#pending = this.#revision
  }

  constructor(source: EventTarget, revision: string, reload?: () => void) {
    this.#source = source
    this.#revision = revision
    this.#reload = reload
    source.addEventListener('message', this.#receive)
  }

  next(): Promise<string> {
    if (this.#closed)
      return Promise.reject(new Error('Dev config updates are closed'))
    if (this.#pending !== undefined) {
      const revision = this.#pending
      this.#pending = undefined
      return Promise.resolve(revision)
    }
    this.#waiting ??= Promise.withResolvers<string>()
    return this.#waiting.promise
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    this.#source.removeEventListener('message', this.#receive)
    this.#waiting?.reject(new Error('Dev config updates are closed'))
    this.#waiting = undefined
    this.#pending = undefined
  }
}
