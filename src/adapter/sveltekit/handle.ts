import type {ServerCMS} from '#/adapter/core/ServerCMS.js'
import {
  createMiddleware,
  type MiddlewareOptions
} from '#/adapter/server/Middleware.js'

/** The part of SvelteKit's `RequestEvent` the handle reads. */
export interface RequestEventLike {
  request: Request
}

/** The input of a SvelteKit `handle` hook. */
export interface HandleInput<Event extends RequestEventLike> {
  event: Event
  resolve(event: Event): Response | Promise<Response>
}

/** A SvelteKit `handle` hook, combinable with `sequence`. */
export type AlineaHandle = <Event extends RequestEventLike>(
  input: HandleInput<Event>
) => Promise<Response>

/**
 * The `handle` hook for `src/hooks.server.ts`. Answers the Alinea routes and
 * resolves every other request within it, so queries in server load
 * functions see its drafts. Draft pages get the previews client.
 */
export function createHandle(
  input: ServerCMS | MiddlewareOptions
): AlineaHandle {
  const middleware = createMiddleware(input)
  return function handle({event, resolve}) {
    return middleware(event.request, () => resolve(event))
  }
}
