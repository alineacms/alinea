/**
 * Messages between the realms of the lab. Every realm (the page, each
 * serverless isolate, each browser's shared worker) listens on a broadcast
 * channel of its own and posts to the channel of the realm it talks to.
 * This module has no imports: realms load it before any Alinea module.
 */

export const mainChannel = 'alinea-lab:main'

export function realmChannel(id: string): string {
  return `alinea-lab:realm:${id}`
}

/** What a worker realm learns from its name, before any module loads. */
export interface RealmIdentity {
  id: string
  kind: 'isolate' | 'dashboard'
  /** Lab session, so a reload of the page never talks to stale workers. */
  session: string
  env: Record<string, string>
  /** Offset of the lab clock against the real clock, in ms. */
  clock: number
  /** Extra data for the realm, eg. the deployment of an isolate. */
  data?: Record<string, unknown>
}

export interface SerializedRequest {
  url: string
  method: string
  headers: Array<[string, string]>
  body: Uint8Array | null
}

export interface SerializedResponse {
  status: number
  headers: Array<[string, string]>
  body: Uint8Array | null
}

/** A realm reports what happened inside it, for the event log. */
export interface TraceEvent {
  realm: string
  /** The part of the realm, eg. `handler-db` or `cms-db`. */
  node?: string
  kind: string
  text: string
  detail?: unknown
  at?: number
}

export type ToMain =
  | {type: 'fetch'; id: number; from: string; request: SerializedRequest}
  | {type: 'abort'; id: number; from: string}
  | {type: 'reply'; id: number; from: string; ok: true; value: unknown}
  | {type: 'reply'; id: number; from: string; ok: false; error: string}
  | {type: 'rpc'; id: number; from: string; method: string; args: unknown}
  | {type: 'trace'; from: string; event: TraceEvent}
  | {type: 'state'; from: string; state: unknown}
  | {type: 'ready'; from: string}

export type ToRealm =
  | {type: 'fetch-result'; id: number; response: SerializedResponse}
  | {type: 'fetch-error'; id: number; error: string}
  | {type: 'rpc-result'; id: number; ok: true; value: unknown}
  | {type: 'rpc-result'; id: number; ok: false; error: string}
  | {type: 'call'; id: number; method: string; args: unknown}
  | {type: 'clock'; offset: number}
  | {type: 'terminate'}

export function encodeName(identity: RealmIdentity): string {
  return JSON.stringify(identity)
}

export function decodeName(name: string): RealmIdentity {
  return JSON.parse(name)
}

/** Delays at least this long follow the lab clock, which can jump ahead. */
export const virtualDelay = 2000
