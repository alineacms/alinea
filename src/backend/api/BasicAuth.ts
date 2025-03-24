import {AuthResultType} from 'alinea/cloud/AuthResult'
import {atob} from 'alinea/core/util/Encoding'
import {AuthAction} from '../Auth.js'
import type {Auth, AuthedContext} from '../Backend.js'

export function basicAuth(
  verify: (username: string, password: string) => boolean | Promise<boolean>
): Auth {
  function unauthorized() {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"'
      }
    })
  }
  return {
    async authenticate(ctx, request) {
      try {
        const verified = await this.verify(ctx, request)
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
    },
    async verify(ctx, request): Promise<AuthedContext> {
      const auth = request.headers.get('Authorization')
      if (!auth) throw unauthorized()
      const [scheme, token] = auth.split(' ', 2)
      if (scheme !== 'Basic') throw unauthorized()
      const [username, password] = atob(token).split(':')
      const authorized = await verify(username, password)
      if (!authorized) throw unauthorized()
      return {
        ...ctx,
        user: {sub: username},
        token
      }
    }
  }
}
