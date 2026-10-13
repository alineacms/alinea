/**
 * The observable state of the lab: an event log, the packets in flight and
 * the last reported state of every node. The view subscribes to it.
 */

export type NodeId = string

export interface LogEvent {
  id: number
  at: number
  /** Real time, to order and space events */
  real: number
  node: NodeId
  part?: string
  kind: string
  text: string
  detail?: unknown
  /** The scenario that was running */
  scenario?: string
}

export interface Packet {
  id: number
  from: NodeId
  to: NodeId
  label: string
  /** How long the hop takes in ms, for the animation. */
  duration: number
  started: number
  kind: 'request' | 'response' | 'error' | 'event'
}

type Listener = () => void

class Bus {
  events: Array<LogEvent> = []
  packets: Array<Packet> = []
  states: Record<NodeId, any> = {}
  /** Nodes that changed recently, for a flash. */
  flashes: Record<NodeId, number> = {}
  scenario: string | undefined
  #listeners = new Set<Listener>()
  #nextId = 1
  #scheduled = false
  version = 0
  /** The lab clock, set by the clock module. */
  now: () => number = () => Date.now()

  subscribe = (listener: Listener) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  getVersion = () => this.version

  changed() {
    if (this.#scheduled) return
    this.#scheduled = true
    requestAnimationFrame(() => {
      this.#scheduled = false
      this.version++
      for (const listener of this.#listeners) listener()
    })
  }

  log(
    event: Omit<LogEvent, 'id' | 'at' | 'real' | 'scenario'> & {at?: number}
  ) {
    const entry: LogEvent = {
      ...event,
      id: this.#nextId++,
      at: event.at ?? this.now(),
      real: performance.now(),
      scenario: this.scenario
    }
    this.events.push(entry)
    if (this.events.length > 2000) this.events.splice(0, 500)
    this.flash(event.node)
    this.changed()
    return entry
  }

  flash(node: NodeId) {
    this.flashes[node] = performance.now()
  }

  send(packet: Omit<Packet, 'id' | 'started'>) {
    const entry = {...packet, id: this.#nextId++, started: performance.now()}
    this.packets.push(entry)
    this.changed()
    setTimeout(() => {
      this.packets = this.packets.filter(p => p !== entry)
      this.changed()
    }, packet.duration + 50)
    return entry
  }

  setState(node: NodeId, state: unknown) {
    this.states[node] = state
    this.changed()
  }

  patchState(node: NodeId, patch: Record<string, unknown>) {
    this.states[node] = {...this.states[node], ...patch}
    this.changed()
  }

  clear() {
    this.events = []
    this.changed()
  }
}

export const bus = new Bus()
