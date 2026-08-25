import type {Revision} from '../replica/Types.js'

export interface ReplicaRevisionEvent {
  sequence: number
  revision: Revision
}

export interface ReplicaRevisionBatch {
  reset: boolean
  events: ReadonlyArray<ReplicaRevisionEvent>
}

/**
 * Small ordered notification log. Events contain no record ids or plaintext;
 * clients fetch their authenticated state after receiving a new revision.
 */
export class ReplicaRevisionLog {
  #capacity: number
  #sequence = 0
  #events: Array<ReplicaRevisionEvent> = []
  #listeners = new Set<(event: ReplicaRevisionEvent) => void>()

  constructor(capacity = 256) {
    if (capacity < 1) throw new Error('Revision log capacity must be positive')
    this.#capacity = capacity
  }

  publish(revision: Revision): ReplicaRevisionEvent {
    const event = {sequence: ++this.#sequence, revision}
    this.#events.push(event)
    if (this.#events.length > this.#capacity) this.#events.shift()
    for (const listener of this.#listeners) listener(event)
    return event
  }

  after(sequence: number): ReplicaRevisionBatch {
    const first = this.#events[0]?.sequence ?? this.#sequence + 1
    if (sequence < first - 1) return {reset: true, events: []}
    return {
      reset: false,
      events: this.#events.filter(event => event.sequence > sequence)
    }
  }

  subscribe(listener: (event: ReplicaRevisionEvent) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
