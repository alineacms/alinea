import {AuthResultType} from 'alinea/cloud/AuthResult'
import type {AuthApi, AuthedContext} from 'alinea/core/Connection'
import type {RequestContext} from 'alinea/core/Connection'
import {atob} from 'alinea/core/util/Encoding'
import {AuthAction} from '../Auth.js'

export interface Verifier {
  (username: string, password: string): boolean | Promise<boolean>
}

export class BasicAuth implements AuthApi {
  #verify: Verifier

  constructor(verify: Verifier) {
    this.#verify = verify
  }

  async authenticate(request: Request, ctx: RequestContext): Promise<Response> {
    try {
      const verified = await this.verify(request, ctx)
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

  async verify(request: Request, ctx: RequestContext): Promise<AuthedContext> {
    const auth = request.headers.get('Authorization')
    if (!auth) throw unauthorized()
    const [scheme, token] = auth.split(' ', 2)
    if (scheme !== 'Basic') throw unauthorized()
    const [username, password] = atob(token).split(':')
    const authorized = await this.#verify(username, password)
    if (!authorized) throw unauthorized()
    return {
      ...ctx,
      user: {sub: username},
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
