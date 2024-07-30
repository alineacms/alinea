import {fetch, Request, Response} from '@alinea/iso'
import {Route, router} from 'alinea/backend/router/Router'
import {Auth} from 'alinea/core/Auth'
import {Config} from 'alinea/core/Config'
import {HttpError} from 'alinea/core/HttpError'
import {outcome} from 'alinea/core/Outcome'
import {User} from 'alinea/core/User'
import {verify} from 'alinea/core/util/JWT'
import {Workspace} from 'alinea/core/Workspace'
import PLazy from 'p-lazy'
import pkg from '../../../package.json'
import {AuthResult, AuthResultType} from '../AuthResult.js'
import {cloudConfig} from './CloudConfig.js'

export type CloudAuthServerOptions = {
  config: Config
  apiKey: string | undefined
}

type JWKS = {keys: Array<JsonWebKey>}

class RemoteUnavailableError extends Error {}

let publicKey = PLazy.from(async function loadPublicKey(
  retry = 0
): Promise<JsonWebKey> {
  try {
    const res = await fetch(cloudConfig.jwks)
    if (res.status !== 200) throw new HttpError(res.status, await res.text())
    const result: JWKS = await res.json()
    const jwks = result
    const key = jwks.keys[0] // .find(key => key.use === 'sig')
    if (!key) throw new HttpError(500, 'No signature key found')
    return key
  } catch (error) {
    if (retry < 3) return loadPublicKey(retry + 1)
    publicKey = PLazy.from(loadPublicKey)
    throw new RemoteUnavailableError('Remote unavailable', {cause: error})
  }
})

const COOKIE_NAME = 'alinea.cloud'

export class CloudAuthServer implements Auth.Server {
  router: Route<Request, Response | undefined>
  context = new WeakMap<Request, {token: string; user: User}>()
  dashboardUrl: string

  constructor(private options: CloudAuthServerOptions) {
    const {apiKey, config} = options

    this.dashboardUrl = config.dashboard?.dashboardUrl!
    const matcher = router.queryMatcher
    this.router = router(
      // We start by asking our backend whether we have:
      // - a logged in user => return the user so we can create a session
      // - no user, but a valid api key => we can redirect to cloud login
      // - no api key => display a message to setup backend
      matcher
        .get('/auth/cloud')
        .map(async ({request}) => {
          return this.authResult(request)
        })
        .map(router.jsonResponse),

      // The cloud server will request a handshake confirmation on this route
      matcher.get('/auth/handshake').map(async ({url}) => {
        const handShakeId = url.searchParams.get('handshake_id')
        if (!handShakeId)
          throw new HttpError(
            400,
            'Provide a valid handshake id to initiate handshake'
          )
        const body: any = {
          handshake_id: handShakeId,
          status: {
            version: pkg.version,
            roles: [
              {
                key: 'editor',
                label: 'Editor',
                description: 'Can view and edit all pages'
              }
            ],
            sourceDirectories: Object.values(config.workspaces)
              .flatMap(workspace => {
                const {source, mediaDir} = Workspace.data(workspace)
                return [source, mediaDir]
              })
              .filter(Boolean)
          }
        }
        if (process.env.VERCEL) {
          body.git = {
            hosting: 'vercel',
            env: process.env.VERCEL_ENV,
            url: process.env.VERCEL_URL,
            provider: process.env.VERCEL_GIT_PROVIDER,
            repo: process.env.VERCEL_GIT_REPO_SLUG,
            owner: process.env.VERCEL_GIT_REPO_OWNER,
            branch: process.env.VERCEL_GIT_COMMIT_REF
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
          throw new HttpError(500, `Could not reach handshake api: ${e}`)
        })
        if (res.status !== 200)
          throw new HttpError(
            res.status,
            `Handshake failed: ${await res.text()}`
          )
        return new Response('alinea cloud handshake')
      }),

      // If the user followed through to the cloud login page it should
      // redirect us here with a token
      matcher.get('/auth').map(async ({request, url}) => {
        if (!apiKey) throw new HttpError(500, 'No api key set')
        const token: string | null = url.searchParams.get('token')
        if (!token) throw new HttpError(400, 'Token required')
        const user = await verify<User>(token, await publicKey)
        // Store the token in a cookie and redirect to the dashboard
        // Todo: add expires and max-age based on token expiration
        const target = new URL(this.dashboardUrl, url)
        return router.redirect(target.href, {
          status: 302,
          headers: {
            'set-cookie': router.cookie({
              name: COOKIE_NAME,
              value: token,
              domain: target.hostname,
              path: '/',
              secure: target.protocol === 'https:',
              httpOnly: true,
              sameSite: 'strict'
            })
          }
        })
      }),

      // The logout route unsets our cookies
      matcher.get('/auth/logout').map(async ({url, request}) => {
        const target = new URL(this.dashboardUrl, url)

        try {
          const {token} = await this.contextFor(request)
          if (token) {
            await fetch(cloudConfig.logout, {
              method: 'POST',
              headers: {authorization: `Bearer ${token}`}
            })
          }
        } catch (e) {
          console.error(e)
        }

        return router.redirect(target.href, {
          status: 302,
          headers: {
            'set-cookie': router.cookie({
              name: COOKIE_NAME,
              value: '',
              domain: target.hostname,
              path: '/',
              secure: target.protocol === 'https:',
              httpOnly: true,
              sameSite: 'strict',
              expires: new Date(0)
            })
          }
        })
      }),

      matcher
        .all('/*')
        .map(async ({request}) => {
          try {
            const {user} = await this.contextFor(request)
          } catch (error) {
            if (error instanceof HttpError) throw error
            throw new HttpError(401, 'Unauthorized', {cause: error})
          }
        })
        .map(router.jsonResponse)
    ).recover(router.reportError)
  }

  async authResult(request: Request): Promise<AuthResult> {
    if (!this.options.apiKey)
      return {
        type: AuthResultType.MissingApiKey,
        setupUrl: cloudConfig.setup
      }
    const [ctx, err] = await outcome(this.contextFor(request))
    if (ctx) return {type: AuthResultType.Authenticated, user: ctx.user}
    const token = this.options.apiKey.split('_')[1]
    if (!token)
      return {
        type: AuthResultType.MissingApiKey,
        setupUrl: cloudConfig.setup
      }
    return {
      type: AuthResultType.UnAuthenticated,
      redirect: `${cloudConfig.auth}?token=${token}`
    }
  }

  async contextFor(request: Request): Promise<{token: string; user: User}> {
    if (this.context.has(request)) return this.context.get(request)!
    const cookies = request.headers.get('cookie')
    if (!cookies) throw new HttpError(401, 'Unauthorized - no cookies')
    const token = cookies
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${COOKIE_NAME}=`))
    if (!token) throw new HttpError(401, `Unauthorized - no ${COOKIE_NAME}`)
    const jwt = token.slice(`${COOKIE_NAME}=`.length)
    return {token: jwt, user: await verify<User>(jwt, await publicKey)}
  }
}
