export class IndexEvent extends Event {
  static readonly type = 'index'
  static [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === IndexEvent.type &&
      'data' in value
    )
  }

  declare data: IndexOp

  constructor(data: IndexOp) {
    super(IndexEvent.type)
    // Test and browser runtimes can replace the global Event implementation
    // after this module was evaluated. Always return an event from the active
    // realm so its EventTarget accepts it.
    if (typeof globalThis.Event === 'function') {
      const event = new globalThis.Event(IndexEvent.type) as IndexEvent
      Object.defineProperty(event, 'data', {value: data, enumerable: true})
      return event
    }
    Object.defineProperty(this, 'data', {value: data, enumerable: true})
    return this
  }
}

export type IndexOp =
  | {op: 'index'; sha: string; ids: Array<string>}
  | {
      op: 'references'
      scanned: number
      total: number
      complete: boolean
    }
  | {
      op: 'mutate'
      id: string
      status: 'pending' | 'success' | 'failure'
      error?: Error
    }
