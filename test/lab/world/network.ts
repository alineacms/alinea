/**
 * The lab network: realms post their `fetch` calls here, and the network
 * routes them by host to a service of the page or to an isolate, with a
 * latency per hop and the faults set on a node. Every hop is drawn as a
 * packet and logged.
 */
import {
  encodeName,
  mainChannel,
  type RealmIdentity,
  realmChannel,
  type SerializedRequest,
  type SerializedResponse,
  type ToMain,
  type ToRealm
} from '../shared/protocol.js'
import {bus, type NodeId} from './bus.js'
import {clock} from './clock.js'

export type Fault = 'down' | 'hang' | 'drop-response'

export interface Route {
  /** The node drawn as the receiver. */
  node: NodeId
  handle(request: SerializedRequest, from: NodeId): Promise<SerializedResponse>
}

export type Resolver = (url: URL, from: NodeId) => Route | undefined

type RpcHandler = (args: any, from: NodeId) => unknown

interface Realm {
  id: string
  node: NodeId
  worker: Worker | SharedWorker
  ready: Promise<void>
  markReady(): void
}

const session = Math.random().toString(36).slice(2, 8)

class Network {
  latency = 250
  faults: Record<NodeId, Fault | undefined> = {}
  /** Requests whose response is lost once, by node and label. */
  #dropOnce = new Map<NodeId, string>()
  #resolvers: Array<Resolver> = []
  #rpc = new Map<string, RpcHandler>()
  #realms = new Map<string, Realm>()
  #pendingCalls = new Map<
    number,
    {resolve(value: unknown): void; reject(error: unknown): void}
  >()
  #aborted = new Set<string>()
  #hung: Array<() => void> = []
  #nextId = 1
  #inbox = new BroadcastChannel(mainChannel)

  constructor() {
    this.#inbox.onmessage = event => this.#receive(event.data as ToMain)
  }

  /** The node of a realm, or the node itself for services of the page. */
  nodeOf(id: string): NodeId {
    return this.#realms.get(id)?.node ?? id
  }

  route(resolver: Resolver) {
    this.#resolvers.push(resolver)
  }

  rpc(method: string, handler: RpcHandler) {
    this.#rpc.set(method, handler)
  }

  setFault(node: NodeId, fault: Fault | undefined) {
    this.faults[node] = fault
    bus.log({
      node,
      kind: 'fault',
      text: fault ? `⚠ ${node} is now ${fault}` : `✓ ${node} recovered`
    })
    if (fault !== 'hang') {
      const hung = this.#hung.splice(0)
      for (const resume of hung) resume()
    }
  }

  /**
   * Lose the response of the next request to a node, after it ran: the next
   * one whose label includes `match`, eg. `/commit`.
   */
  dropNextResponse(node: NodeId, match = '') {
    this.#dropOnce.set(node, match)
    bus.log({
      node,
      kind: 'fault',
      text: `⚠ the next response of ${node}${match ? ` to ${match}` : ''} will be lost`
    })
  }

  #drops(to: NodeId, label: string) {
    const match = this.#dropOnce.get(to)
    if (match === undefined || !label.includes(match)) return false
    this.#dropOnce.delete(to)
    return true
  }

  delay(ms = this.latency) {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
  }

  /** Wait while the node hangs. */
  async #passable(node: NodeId) {
    while (this.faults[node] === 'hang')
      await new Promise<void>(resolve => this.#hung.push(resolve))
  }

  async request(
    from: NodeId,
    request: SerializedRequest,
    key?: string
  ): Promise<SerializedResponse> {
    const url = new URL(request.url)
    let route: Route | undefined
    for (const resolver of this.#resolvers) {
      route = resolver(url, from)
      if (route) break
    }
    if (!route) throw new TypeError(`No route to ${url.host}`)
    const to = route.node
    const label = describe(url, request)
    bus.send({from, to, label, duration: this.latency, kind: 'request'})
    await this.delay()
    const fault = this.faults[to]
    if (fault === 'down') {
      bus.log({
        node: to,
        kind: 'refused',
        text: `✗ ${label} from ${from}: ${to} is down`
      })
      bus.send({
        from: to,
        to: from,
        label: '✗ refused',
        duration: this.latency,
        kind: 'error'
      })
      await this.delay()
      throw new TypeError(`Failed to fetch: ${url.host} is down`)
    }
    if (fault === 'hang') {
      bus.log({
        node: to,
        kind: 'hang',
        text: `… ${label} from ${from} hangs: ${to} does not answer`
      })
      await this.#passable(to)
    }
    if (key && this.#aborted.delete(key))
      throw new DOMException('Aborted', 'AbortError')
    const response = await route.handle(request, from)
    if (this.#drops(to, label) || this.faults[to] === 'drop-response') {
      bus.log({
        node: to,
        kind: 'dropped',
        text: `✗ ${label}: ${to} ran it (${response.status}), the response to ${from} was lost`
      })
      bus.send({
        from: to,
        to: from,
        label: '✗ lost',
        duration: this.latency,
        kind: 'error'
      })
      await this.delay()
      throw new TypeError('Failed to fetch: connection reset')
    }
    bus.log({
      node: to,
      kind: 'http',
      text: `${from} → ${label} → ${response.status}`,
      detail: {from, to, label, status: response.status}
    })
    bus.send({
      from: to,
      to: from,
      label: `${response.status} ${label}`,
      duration: this.latency,
      kind: response.status < 400 ? 'response' : 'error'
    })
    await this.delay()
    return response
  }

  // Realms ----------------------------------------------------------------

  spawn(
    identity: Omit<RealmIdentity, 'session' | 'clock'>,
    node: NodeId,
    create: (name: string) => Worker | SharedWorker
  ): Realm {
    const full: RealmIdentity = {...identity, session, clock: clock.offset}
    let markReady!: () => void
    const ready = new Promise<void>(resolve => {
      markReady = resolve
    })
    const realm: Realm = {
      id: identity.id,
      node,
      worker: undefined!,
      ready,
      markReady
    }
    this.#realms.set(identity.id, realm)
    clock.register(identity.id)
    realm.worker = create(encodeName(full))
    if ('onerror' in realm.worker)
      realm.worker.addEventListener('error', event => {
        bus.log({
          node,
          kind: 'error',
          text: `worker error: ${(event as ErrorEvent).message ?? 'unknown'}`
        })
      })
    return realm
  }

  realm(id: string) {
    return this.#realms.get(id)
  }

  terminate(id: string) {
    const realm = this.#realms.get(id)
    if (!realm) return
    this.#post(id, {type: 'terminate'})
    if (realm.worker instanceof Worker) realm.worker.terminate()
    this.#realms.delete(id)
    clock.unregister(id)
  }

  async call<T>(id: string, method: string, args?: unknown): Promise<T> {
    const realm = this.#realms.get(id)
    if (!realm) throw new Error(`No realm ${id}`)
    await realm.ready
    const callId = this.#nextId++
    return new Promise<T>((resolve, reject) => {
      this.#pendingCalls.set(callId, {
        resolve: resolve as (value: unknown) => void,
        reject
      })
      this.#post(id, {type: 'call', id: callId, method, args})
    })
  }

  #post(id: string, message: ToRealm) {
    const channel = new BroadcastChannel(realmChannel(id))
    channel.postMessage(message)
    channel.close()
  }

  async #receive(message: ToMain) {
    const realm = this.#realms.get(message.from)
    if (!realm) return
    const node = realm.node
    switch (message.type) {
      case 'ready':
        realm.markReady()
        return
      case 'trace': {
        const {event} = message
        bus.log({
          node,
          part: event.node,
          kind: event.kind,
          text: event.text,
          detail: event.detail,
          at: event.at
        })
        return
      }
      case 'state':
        bus.setState(node, message.state)
        return
      case 'reply': {
        const waiting = this.#pendingCalls.get(message.id)
        if (!waiting) return
        this.#pendingCalls.delete(message.id)
        if (message.ok) waiting.resolve(message.value)
        else waiting.reject(new Error(message.error))
        return
      }
      case 'abort':
        this.#aborted.add(`${message.from}:${message.id}`)
        return
      case 'fetch': {
        try {
          const response = await this.request(
            node,
            message.request,
            `${message.from}:${message.id}`
          )
          this.#post(message.from, {
            type: 'fetch-result',
            id: message.id,
            response
          })
        } catch (error) {
          this.#post(message.from, {
            type: 'fetch-error',
            id: message.id,
            error: error instanceof Error ? error.message : String(error)
          })
        }
        return
      }
      case 'rpc': {
        const handler = this.#rpc.get(message.method)
        try {
          if (!handler) throw new Error(`No service for ${message.method}`)
          const value = await handler(message.args, node)
          this.#post(message.from, {
            type: 'rpc-result',
            id: message.id,
            ok: true,
            value
          })
        } catch (error) {
          this.#post(message.from, {
            type: 'rpc-result',
            id: message.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
        return
      }
    }
  }
}

function describe(url: URL, request: SerializedRequest): string {
  const action = url.searchParams.get('action')
  if (action) {
    const auth = url.searchParams.get('auth')
    return `${request.method} ${action}${auth ? `:${auth}` : ''}`
  }
  return `${request.method} ${url.pathname}`
}

export const network = new Network()

export function textResponse(
  status: number,
  body: string,
  type = 'text/plain'
): SerializedResponse {
  return {
    status,
    headers: [['content-type', type]],
    body: new TextEncoder().encode(body)
  }
}

export function jsonResponse(value: unknown, status = 200): SerializedResponse {
  return textResponse(status, JSON.stringify(value), 'application/json')
}

export function requestJson<T>(request: SerializedRequest): T {
  return JSON.parse(new TextDecoder().decode(request.body ?? new Uint8Array()))
}
