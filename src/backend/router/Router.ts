import {CompressionStream, Headers, type Request, Response} from '@alinea/iso'
import {Outcome} from 'alinea/core/Outcome'
import {parse} from 'regexparam'

export interface HttpRouter {
  (input: Request): Promise<Response>
}

export interface Handle<In, Out> {
  (input: In): Out | undefined | Promise<Out | undefined>
}

type Next<In, Out> = Handle<In, Out> | Route<In, Out>

export class Route<In, Out> {
  constructor(public handle: Handle<In, Out>) {}
  map<T>(next: Handle<Out, T>): Route<In, T>
  map<T>(next: Route<Out, T>): Route<In, T>
  map<T>(next: Next<Out, T>): Route<In, T> {
    return new Route<In, T>(input => {
      const result = this.handle(input)
      if (result instanceof Promise)
        return result.then(v => {
          return v === undefined ? undefined : callHandler(next, v)
        })
      if (result !== undefined) return callHandler(next, result)
    })
  }
  notFound(handler: (input: In) => Out | Promise<Out>): Route<In, Out> {
    return new Route<In, Out>(async (input: In) => {
      let result = this.handle(input)
      if (result instanceof Promise) result = await result
      if (result === undefined) return handler(input)
      return result
    })
  }
  recover(handler: (error: Error) => Out | Promise<Out>): Route<In, Out> {
    return new Route<In, Out>(async (input: In) => {
      try {
        let result = this.handle(input)
        if (result instanceof Promise) result = await result
        return result
      } catch (e) {
        const error =
          e instanceof Error ? e : new Error(`Could not serve request: ${e}`)
        return handler(error)
      }
    })
  }
}

export function router(
  ...routes: Array<Next<Request, Response | undefined> | undefined>
): Route<Request, Response | undefined> {
  return new Route<Request, Response | undefined>(async (request: Request) => {
    for (const handler of routes) {
      if (!handler) continue
      let result = callHandler(handler, request)
      if (result instanceof Promise) result = await result
      if (result !== undefined) return result
    }
  })
}

function callHandler<In, Out>(handler: Next<In, Out>, input: In) {
  return typeof handler === 'function' ? handler(input) : handler.handle(input)
}

export namespace router {
  export function use<In, Out>(handle: Handle<In, Out>) {
    return new Route(handle)
  }

  function withMethod(method: string) {
    return use((request: Request) => {
      if (request.method !== method) return undefined
      return request
    })
  }

  function withPath(path: string, getPathname: (url: URL) => string) {
    const matcher = parse(path)
    return use((request: Request) => {
      const url = new URL(request.url)
      const match = matcher.pattern.exec(getPathname(url))
      if (match === null) return undefined
      const params: Record<string, unknown> = {}
      if (matcher.keys)
        for (let i = 0; i < matcher.keys.length; i++)
          params[matcher.keys[i]] = match[i + 1]
      return {request, url, params}
    })
  }

  export function matcher(getPathname = (url: URL) => url.pathname) {
    return {
      get(path: string) {
        return withMethod('GET').map(withPath(path, getPathname))
      },
      post(path: string) {
        return withMethod('POST').map(withPath(path, getPathname))
      },
      put(path: string) {
        return withMethod('PUT').map(withPath(path, getPathname))
      },
      delete(path: string) {
        return withMethod('DELETE').map(withPath(path, getPathname))
      },
      all(path: string) {
        return withPath(path, getPathname)
      }
    }
  }

  export function base(url: string) {
    const base = new URL(url).pathname
    const prefix = base.endsWith('/') ? base.slice(0, -1) : base
    return matcher(({pathname}) => {
      if (pathname.startsWith(prefix)) return pathname.slice(prefix.length)
      return pathname
    })
  }

  export const queryMatcher = matcher(({search}) => {
    const rest = search.indexOf('&')
    return rest > -1 ? search.slice(1, rest) : search.slice(1)
  })

  export async function parseFormData<In extends {request: Request}>(
    input: In
  ): Promise<In & {body: FormData}> {
    const body = await input.request.formData()
    return {...input, body}
  }

  export async function parseBuffer<In extends {request: Request}>(
    input: In
  ): Promise<In & {body: ArrayBuffer}> {
    const body = await input.request.arrayBuffer()
    return {...input, body}
  }

  export async function parseJson<In extends {request: Request}>(
    input: In
  ): Promise<In & {body: unknown}> {
    const body = await input.request.json()
    return {...input, body}
  }

  export function reportError(error: any) {
    console.error(error)
    return Response.json({success: false, error}, {status: 500})
  }

  export function redirect(url: string, init: ResponseInit = {}) {
    return new Response('', {
      ...init,
      headers: {location: url, ...init.headers},
      status: init.status || 301
    })
  }

  export type Cookie = {
    name: string
    value: string
    expires?: Date
    maxAge?: number
    domain?: string
    path?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
  }

  type CookieValue = [key: string, value: boolean | string | number | Date]

  function cookieValue([key, value]: CookieValue) {
    if (value === true) return `; ${key}`
    if (value === false) return ''
    if (value instanceof Date) return `; ${key}=${value.toUTCString()}`
    return `; ${key}=${String(value)}`
  }

  export function cookie(...cookies: Array<Cookie>) {
    return cookies
      .map(cookie => {
        const {name, value, ...rest} = cookie
        return `${name}=${value}${Object.entries(rest).map(cookieValue).join('')}`
      })
      .join(', ')
  }

  export function compress(
    ...routes: Array<Next<Request, Response | undefined>>
  ): Route<Request, Response | undefined> {
    const route = router(...routes)
    return new Route<Request, Response | undefined>(
      async (request: Request) => {
        const response = await route.handle(request)
        if (response === undefined) return undefined
        const body = response.body
        if (!body) return response
        const isCompressed = response.headers.get('content-encoding')
        if (isCompressed) return response
        const accept = request.headers.get('accept-encoding')
        const method = accept?.includes('gzip')
          ? 'gzip'
          : accept?.includes('deflate')
            ? 'deflate'
            : undefined
        if (method === undefined) return response
        const stream = body.pipeThrough(new CompressionStream(method))
        const headers = new Headers(response.headers)
        headers.set('content-encoding', method)
        headers.delete('content-length')
        return new Response(stream, {
          headers,
          status: response.status
        })
      }
    )
  }
}
