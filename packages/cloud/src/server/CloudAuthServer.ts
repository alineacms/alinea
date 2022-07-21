import {Handler, router} from '@alinea/backend/router/Router'
import {Auth, Config, createError, Hub, outcome, User} from '@alinea/core'
import {verify} from '@alinea/core/util/JWT'
import {fetch, Request, Response} from '@alinea/iso'
import {version} from '../../package.json'
import {cloudConfig} from './CloudConfig'

export enum AuthResultType {
  Authenticated,
  UnAuthenticated,
  MissingApiKey
}

export type AuthResult =
  | {type: AuthResultType.Authenticated; user: User}
  | {type: AuthResultType.UnAuthenticated; redirect: string}
  | {type: AuthResultType.MissingApiKey}

export type CloudAuthServerOptions = {
  config: Config
  apiKey: string | undefined
}

type JWKS = {keys: Array<JsonWebKey>}

function getPublicKey(): Promise<JsonWebKey> {
  // Todo: some retries before we give up
  return fetch(cloudConfig.jwks)
    .then<JWKS>(res => res.json())
    .then(jwks => {
      const key = jwks.keys[0] // .find(key => key.use === 'sig')
      if (!key) throw createError(500, 'No signature key found')
      return key
    })
}

const COOKIE_NAME = 'alinea.cloud'

export class CloudAuthServer implements Auth.Server {
  handler: Handler<Request, Response | undefined>
  context = new WeakMap<Request, {token: string; user: User}>()
  key = getPublicKey()
  dashboardUrl: string

  constructor(private options: CloudAuthServerOptions) {
    const {apiKey, config} = options

    this.dashboardUrl = config.dashboard?.dashboardUrl!
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

      // The cloud server will request a handshake confirmation on this route
      matcher.get(Hub.routes.base + '/auth/handshake').map(async ({url}) => {
        if (!apiKey) throw createError(500, 'No api key set')
        const handShakeId = url.searchParams.get('handshake_id')
        if (!handShakeId)
          throw createError(
            400,
            'Provide a valid handshake id to initiate handshake'
          )
        const body = {
          handshake_id: handShakeId,
          status: {
            version,
            roles: [
              {
                key: 'editor',
                label: 'Editor',
                description: 'Can view and edit all pages'
              }
            ],
            sourceDirectories: Object.values(config.workspaces).map(
              workspace => {
                return workspace.source
              }
            )
          }
        }
        // We submit the handshake id, our status and authorize using the
        // private key
        const res = await fetch(cloudConfig.handshake, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            authorization: `Bearer ${apiKey}`
          }
        }).catch(e => {
          throw createError(500, `Could not reach handshake api: ${e}`)
        })
        if (res.status !== 200)
          throw createError(res.status, `Handshake failed: ${await res.text()}`)
        return new Response('alinea cloud handshake')
      }),

      // If the user followed through to the cloud login page it should
      // redirect us here with a token
      matcher.get(Hub.routes.base + '/auth').map(async ({request, url}) => {
        if (!apiKey) throw createError(500, 'No api key set')
        const token: string | null = url.searchParams.get('token')
        if (!token) throw createError(400, 'Token required')
        const user = await verify<User>(token, await this.key)
        // Store the token in a cookie and redirect to the dashboard
        // Todo: add expires and max-age based on token expiration
        const target = new URL(this.dashboardUrl)
        return router.redirect(this.dashboardUrl, {
          status: 302,
          headers: {
            'set-cookie': router.cookie({
              name: COOKIE_NAME,
              value: token,
              domain: target.hostname,
              path: target.pathname,
              secure: target.protocol === 'https:',
              httpOnly: true,
              sameSite: 'strict'
            })
          }
        })
      }),

      router
        .use(async (request: Request) => {
          try {
            const {user} = await this.contextFor(request)
          } catch (e) {
            throw createError(401, 'Unauthorized')
          }
        })
        .map(router.jsonResponse)
    ).recover(router.reportError)
  }

  async authResult(request: Request): Promise<AuthResult> {
    if (!this.options.apiKey) return {type: AuthResultType.MissingApiKey}
    const [ctx, err] = await outcome(this.contextFor(request))
    if (ctx) return {type: AuthResultType.Authenticated, user: ctx.user}
    return {
      type: AuthResultType.UnAuthenticated,
      redirect: `${cloudConfig.auth}`
    }
  }

  async contextFor(request: Request): Promise<{token: string; user: User}> {
    if (this.context.has(request)) return this.context.get(request)!
    const cookies = request.headers.get('cookie')
    if (!cookies) throw createError(401, 'Unauthorized')
    const token = cookies
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${COOKIE_NAME}=`))
    if (!token) throw createError(401, 'Unauthorized')
    const jwt = token.slice(`${COOKIE_NAME}=`.length)
    return {token: jwt, user: await verify<User>(jwt, await this.key)}
  }
}
