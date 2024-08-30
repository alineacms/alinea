import {atob} from 'alinea/core/util/Encoding'
import {Auth, AuthedContext} from '../Backend.js'

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
      const auth = request.headers.get('Authorization')
      if (!auth) return unauthorized()
      const [scheme, token] = auth.split(' ', 2)
      if (scheme !== 'Basic') throw unauthorized()
      const [username, password] = atob(token).split(':')
      const authorized = await verify(username, password)
      if (!authorized) return unauthorized()
      const from = new URL(request.url)
      return new Response('Authorized', {
        status: 302,
        headers: {
          location: from.pathname
        }
      })
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
