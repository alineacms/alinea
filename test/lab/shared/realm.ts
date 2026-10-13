/**
 * Prepares a worker realm before any Alinea module loads: the environment
 * variables of the deployment, the lab clock, a `fetch` that travels over the
 * lab network and, for a browser, its own IndexedDB. Import this first.
 */
import {
  decodeName,
  mainChannel,
  realmChannel,
  type SerializedRequest,
  type ToMain,
  type ToRealm,
  type TraceEvent,
  virtualDelay
} from './protocol.js'

declare const self: {name: string}

export const identity = decodeName(self.name)

// biome-ignore lint: process is read by Alinea modules
;(globalThis as any).process = {env: {...identity.env}}

const toMain = new BroadcastChannel(mainChannel)
const inbox = new BroadcastChannel(realmChannel(identity.id))

function post(message: ToMain) {
  toMain.postMessage(message)
}

// Lab clock -------------------------------------------------------------

const realNow = Date.now.bind(Date)
const realSetTimeout = globalThis.setTimeout.bind(globalThis)
const realClearTimeout = globalThis.clearTimeout.bind(globalThis)
const realSetInterval = globalThis.setInterval.bind(globalThis)
const realClearInterval = globalThis.clearInterval.bind(globalThis)
let offset = identity.clock

Date.now = () => realNow() + offset

interface VirtualTimer {
  id: number
  due: number
  run: () => void
  every?: number
}
const timers = new Map<number, VirtualTimer>()
let nextTimer = 1_000_000_000

function fireDue() {
  const now = Date.now()
  const due = [...timers.values()]
    .filter(timer => timer.due <= now)
    .sort((a, b) => a.due - b.due)
  for (const timer of due) {
    if (!timers.has(timer.id)) continue
    if (timer.every) timer.due = now + timer.every
    else timers.delete(timer.id)
    try {
      timer.run()
    } catch (error) {
      console.error(error)
    }
  }
}
realSetInterval(fireDue, 200)

function virtual(
  handler: unknown,
  delay: number,
  args: Array<unknown>,
  every?: number
) {
  const id = nextTimer++
  const run =
    typeof handler === 'function'
      ? () => (handler as Function)(...args)
      : () => {}
  timers.set(id, {id, due: Date.now() + delay, run, every})
  return id
}

// biome-ignore lint: timers are patched for the whole realm
const g = globalThis as any
g.setTimeout = (handler: unknown, delay = 0, ...args: Array<unknown>) =>
  delay >= virtualDelay
    ? virtual(handler, delay, args)
    : realSetTimeout(handler as TimerHandler, delay, ...args)
g.setInterval = (handler: unknown, delay = 0, ...args: Array<unknown>) =>
  delay >= virtualDelay
    ? virtual(handler, delay, args, delay)
    : realSetInterval(handler as TimerHandler, delay, ...args)
g.clearTimeout = (id: number) => {
  if (timers.delete(id)) return
  realClearTimeout(id)
}
g.clearInterval = (id: number) => {
  if (timers.delete(id)) return
  realClearInterval(id)
}

/** Timers waiting on the lab clock, for inspection. */
export function pendingTimers() {
  const now = Date.now()
  return [...timers.values()].map(timer => ({
    inMs: timer.due - now,
    every: timer.every
  }))
}

// Calls --------------------------------------------------------------------

let nextId = 1
const pending = new Map<
  number,
  {resolve: (value: any) => void; reject: (error: unknown) => void}
>()
type CallHandler = (args: any) => unknown
const handlers = new Map<string, CallHandler>()

/** Answer calls of the page. */
export function handle(method: string, handler: CallHandler) {
  handlers.set(method, handler)
}

/** Call a service of the page, such as the shared Next.js data cache. */
export function callMain<T>(method: string, args?: unknown): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {resolve, reject})
    post({type: 'rpc', id, from: identity.id, method, args})
  })
}

export function trace(event: Omit<TraceEvent, 'realm'>) {
  post({
    type: 'trace',
    from: identity.id,
    event: {...event, realm: identity.id, at: Date.now()}
  })
}

export function reportState(state: unknown) {
  post({type: 'state', from: identity.id, state})
}

export function ready() {
  post({type: 'ready', from: identity.id})
}

inbox.onmessage = async event => {
  const message = event.data as ToRealm
  switch (message.type) {
    case 'clock':
      offset = message.offset
      fireDue()
      return
    case 'fetch-result':
    case 'rpc-result':
    case 'fetch-error': {
      const waiting = pending.get(message.id)
      if (!waiting) return
      pending.delete(message.id)
      if (message.type === 'fetch-result') waiting.resolve(message.response)
      else if (message.type === 'fetch-error')
        waiting.reject(new TypeError(message.error))
      else if (message.ok) waiting.resolve(message.value)
      else waiting.reject(new Error(message.error))
      return
    }
    case 'call': {
      const handler = handlers.get(message.method)
      try {
        if (!handler) throw new Error(`No handler for ${message.method}`)
        const value = await handler(message.args)
        post({
          type: 'reply',
          id: message.id,
          from: identity.id,
          ok: true,
          value
        })
      } catch (error) {
        post({
          type: 'reply',
          id: message.id,
          from: identity.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
      return
    }
    case 'terminate':
      g.close?.()
      return
  }
}

// Network --------------------------------------------------------------------

export async function serializeRequest(
  request: Request
): Promise<SerializedRequest> {
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? null
      : new Uint8Array(await request.arrayBuffer())
  return {
    url: request.url,
    method: request.method,
    headers: [...request.headers],
    body
  }
}

const RealRequest = globalThis.Request
const RealResponse = globalThis.Response

g.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new RealRequest(input, init)
  const signal = init?.signal ?? request.signal
  signal?.throwIfAborted()
  const serialized = await serializeRequest(request)
  const id = nextId++
  const response = await new Promise<{
    status: number
    headers: Array<[string, string]>
    body: Uint8Array | null
  }>((resolve, reject) => {
    pending.set(id, {resolve, reject})
    signal?.addEventListener('abort', () => {
      if (!pending.delete(id)) return
      post({type: 'abort', id, from: identity.id})
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    })
    post({type: 'fetch', id, from: identity.id, request: serialized})
  })
  const nullBody = response.status === 204 || response.status === 304
  return new RealResponse(
    nullBody ? null : (response.body as BodyInit | null),
    {
      status: response.status,
      headers: response.headers
    }
  )
}

// Storage of a browser ------------------------------------------------------

if (identity.kind === 'dashboard' && globalThis.indexedDB) {
  const real = globalThis.indexedDB
  const prefix = `${String(identity.data?.browser ?? identity.id)}/`
  const factory = {
    open: (name: string, version?: number) => real.open(prefix + name, version),
    deleteDatabase: (name: string) => real.deleteDatabase(prefix + name),
    cmp: (a: unknown, b: unknown) => real.cmp(a, b),
    async databases() {
      const all = await real.databases()
      return all
        .filter(info => info.name?.startsWith(prefix))
        .map(info => ({...info, name: info.name!.slice(prefix.length)}))
    }
  }
  Object.defineProperty(globalThis, 'indexedDB', {
    value: factory,
    configurable: true
  })
}
