import {Handler, router} from '@alinea/backend/router/Router'
import {verify} from '@alinea/backend/util/JWT'
import {Auth, createError, Hub, outcome, User} from '@alinea/core'
import {fetch, Request, Response} from '@alinea/iso'
import {API_DSN, JWKS_URL} from './CloudConfig'

export enum AuthResultType {
  Authenticated,
  UnAuthenticated,
  MissingApiKey
}

export type AuthResult =
  | {type: AuthResultType.Authenticated; user: User}
  | {type: AuthResultType.UnAuthenticated; redirect: string}
  | {type: AuthResultType.MissingApiKey}

export type CloudAuthServerOptions = {apiKey: string | undefined}

type JWKS = {keys: Array<JsonWebKey>}

function getPublicKey(): Promise<JsonWebKey> {
  // Todo: some retries before we give up
  return fetch(JWKS_URL)
    .then<JWKS>(res => res.json())
    .then(jwks => {
      const key = jwks.keys[0] // .find(key => key.use === 'sig')
      if (!key) throw createError(500, 'No signature key found')
      return key
    })
}

const COOKIE_NAME = 'alinea.cloud'

export class CloudAuthServer implements Auth.Server {
  handler: Handler<Request, Response>
  users = new WeakMap<Request, User>()
  key = getPublicKey()

  constructor(private options: CloudAuthServerOptions) {
    const matcher = router.startAt(Hub.routes.base)
    this.handler = router(
      // We start by asking our backend whether we have:
      // - a logged in user => return the user so we can create a session
      // - no user, but a valid api key => we can redirect to cloud login
      // - no api key => display a message to setup backend
      matcher
        .get(Hub.routes.base + '/auth.cloud')
        .map(async ({request}) => {
          return this.authResult(request)
        })
        .map(router.jsonResponse),

      // If the user followed through to the cloud login page it should
      // redirect us here with a token
      matcher
        .get(Hub.routes.base + '/auth.cloud/login')
        .map(async ({request, url}) => {
          const token: string | null = url.searchParams.get('token')
          if (!token) throw createError(400, 'Token required')
          const user = await verify<User>(token, await this.key)
          // Store the token in a cookie and redirect to the dashboard
          // Todo: add expires and max-age based on token expiration
          const dashboardUrl: URL = new URL(this.baseUrl(request))
          return router.redirect(dashboardUrl.toString(), {
            status: 302,
            headers: {
              'set-cookie': router.cookie({
                name: COOKIE_NAME,
                value: token,
                domain: dashboardUrl.hostname,
                path: dashboardUrl.pathname,
                secure: dashboardUrl.protocol === 'https:',
                httpOnly: true,
                sameSite: 'strict'
              })
            }
          })
        }),

      router
        .use(async (request: Request) => {
          try {
            const user = await this.userFor(request)
          } catch (e) {
            throw createError(401, 'Unauthorized')
          }
        })
        .map(router.jsonResponse)
    ).recover(router.reportError)
  }

  baseUrl(request: Request) {
    const index = request.url.indexOf(Hub.routes.base)
    return request.url.slice(0, index)
  }

  async authResult(request: Request): Promise<AuthResult> {
    if (!this.options.apiKey) return {type: AuthResultType.MissingApiKey}
    const [user, err] = await outcome(this.userFor(request))
    if (user) return {type: AuthResultType.Authenticated, user}
    const dashboardUrl = this.baseUrl(request)
    return {
      type: AuthResultType.UnAuthenticated,
      redirect: `${API_DSN}/login?from=${dashboardUrl}`
    }
  }

  async userFor(request: Request) {
    if (this.users.has(request)) return this.users.get(request)!
    const cookies = request.headers.get('cookie')
    if (!cookies) throw createError(401, 'Unauthorized')
    const token = cookies
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${COOKIE_NAME}=`))
    if (!token) throw createError(401, 'Unauthorized')
    const jwt = token.slice(`${COOKIE_NAME}=`.length)
    return verify<User>(jwt, await this.key)
  }
}
