import {AuthResultType} from 'alinea/cloud/AuthResult'
import type {
  AuthApi,
  AuthedContext,
  RequestContext
} from 'alinea/core/Connection'
import {atob} from 'alinea/core/util/Encoding'
import {
  AuthAction,
  InvalidCredentialsError,
  MissingCredentialsError
} from '../Auth.js'

export interface Verifier {
  (username: string, password: string): boolean | Promise<boolean>
}

export class BasicAuth implements AuthApi {
  #context: RequestContext
  #verify: Verifier

  constructor(context: RequestContext, verify: Verifier) {
    this.#context = context
    this.#verify = verify
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
    if (!auth) throw new MissingCredentialsError('Missing authorization header')
    const [scheme, token] = auth.split(' ', 2)
    if (scheme !== 'Basic')
      throw new MissingCredentialsError('Invalid authorization scheme')
    const [username, password] = atob(token).split(':')
    const authorized = await this.#verify(username, password)
    if (!authorized) throw new InvalidCredentialsError('Invalid credentials')
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
