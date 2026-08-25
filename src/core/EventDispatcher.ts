interface ListenerEntry {
  listener: EventListenerOrEventListenerObject
  once: boolean
}

/** EventTarget implementation that also accepts events created in another realm. */
export class EventDispatcher implements EventTarget {
  #listeners = new Map<string, Array<ListenerEntry>>()

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
  ): void {
    if (!callback) return
    const listeners = this.#listeners.get(type) ?? []
    if (listeners.some(entry => entry.listener === callback)) return
    listeners.push({
      listener: callback,
      once: typeof options === 'object' && options.once === true
    })
    this.#listeners.set(type, listeners)
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null
  ): void {
    if (!callback) return
    const listeners = this.#listeners.get(type)
    if (!listeners) return
    const remaining = listeners.filter(entry => entry.listener !== callback)
    if (remaining.length) this.#listeners.set(type, remaining)
    else this.#listeners.delete(type)
  }

  dispatchEvent(event: Event): boolean {
    const listeners = [...(this.#listeners.get(event.type) ?? [])]
    for (const entry of listeners) {
      if (entry.once) this.removeEventListener(event.type, entry.listener)
      if (typeof entry.listener === 'function') entry.listener.call(this, event)
      else entry.listener.handleEvent(event)
    }
    return !event.defaultPrevented
  }
}
