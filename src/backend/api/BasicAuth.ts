import {AuthResultType} from 'alinea/cloud/AuthResult'
import type {AuthApi, AuthedContext} from 'alinea/core/Connection'
import type {RequestContext} from 'alinea/core/Connection'
import type {User} from 'alinea/core/User'
import {atob} from 'alinea/core/util/Encoding'
import {AuthAction} from '../Auth.js'

export type Details = boolean | User | undefined

export interface Verifier {
  (username: string, password: string): Details | Promise<Details>
}

export class BasicAuth implements AuthApi {
  #context: RequestContext
  #verify: Verifier

  constructor(context: RequestContext, verify: Verifier) {
    this.#verify = verify
    this.#context = context
  }

  async authenticate(request: Request): Promise<Response> {
    try {
      const verified = await this.verify(request)
      const url = new URL(request.url)
      const action = url.searchParams.get('auth')
      switch (action) {
        case AuthAction.Status: {
          return Response.json({
            type: AuthResultType.Authenticated,
            user: verified.user
          })
        }
        default:
          return new Response('Bad request', {status: 400})
      }
    } catch {
      return unauthorized()
    }
  }

  async verify(request: Request): Promise<AuthedContext> {
    const ctx = this.#context
    const auth = request.headers.get('Authorization')
    if (!auth) throw unauthorized()
    const [scheme, token] = auth.split(' ', 2)
    if (scheme !== 'Basic') throw unauthorized()
    const [username, password] = atob(token).split(':')
    const authorized = await this.#verify(username, password)
    if (!authorized) throw unauthorized()
    const user =
      typeof authorized === 'boolean'
        ? {
            sub: username,
            roles: ['admin']
          }
        : authorized
    return {
      ...ctx,
      user,
      token
    }
  }
}

function unauthorized() {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"'
    }
  })
}
