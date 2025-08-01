import {Request, Response} from '@alinea/iso'
import {
  generateCodeVerifier,
  OAuth2Client,
  type OAuth2Token
} from '@badgateway/oauth2-client'
import {AuthResultType} from 'alinea/cloud/AuthResult'
import type {Config} from 'alinea/core/Config'
import type {
  AuthApi,
  AuthedContext,
  RequestContext
} from 'alinea/core/Connection'
import {HttpError} from 'alinea/core/HttpError'
import {createId} from 'alinea/core/Id'
import {outcome} from 'alinea/core/Outcome'
import type {User} from 'alinea/core/User'
import {assert} from 'alinea/core/util/Assert'
import {decode, verify} from 'alinea/core/util/JWT'
import {parse} from 'cookie-es'
import PLazy from 'p-lazy'
import {
  AuthAction,
  InvalidCredentialsError,
  MissingCredentialsError
} from '../Auth.js'
import {router} from '../router/Router.js'

type JWKS = {keys: Array<JsonWebKey & {kid: string}>}

export interface OAuth2Options {
  /**
   * OAuth2 clientId
   */
  clientId: string

  /**
   * OAuth2 clientSecret
   *
   * This is required when using the 'client_secret_basic' authenticationMethod
   * for the client_credentials and password flows, but not authorization_code
   * or implicit.
   */
  clientSecret?: string

  /**
   * The JSON Web Key Set (JWKS) URI.
   */
  jwksUri: string

  /**
   * The /authorize endpoint.
   *
   * Required only for the browser-portion of the authorization_code flow.
   */
  authorizationEndpoint: string

  /**
   * The token endpoint.
   *
   * Required for most grant types and refreshing tokens.
   */
  tokenEndpoint: string

  /**
   * Revocation endpoint.
   *
   * Required for revoking tokens. Not supported by all servers.
   */
  revocationEndpoint?: string
}

const COOKIE_VERIFIER = 'alinea.cv'
const COOKIE_ACCESS_TOKEN = 'alinea.at'
const COOKIE_REFRESH_TOKEN = 'alinea.rt'

export class OAuth2 implements AuthApi {
  #context: RequestContext
  #config: Config
  #client: OAuth2Client
  #jwks: Promise<Array<JsonWebKey & {kid: string}>>

  constructor(context: RequestContext, config: Config, options: OAuth2Options) {
    this.#context = context
    this.#config = config
    this.#client = new OAuth2Client({
      ...options,
      authenticationMethod: 'client_secret_basic_interop',
      async fetch(input: RequestInfo | URL, init?: RequestInit) {
        const request = new Request(input, init)
        const response = await fetch(request)
        if (!response.ok) {
          const text = await response.text()
          throw new HttpError(response.status, text)
        }
        return response
      }
    })
    const loadJwks = async (): Promise<Array<JsonWebKey & {kid: string}>> => {
      try {
        const res = await fetch(options.jwksUri)
        if (res.status !== 200)
          throw new HttpError(res.status, await res.text())
        const jwks: JWKS = await res.json()
        return jwks.keys
      } catch (cause) {
        this.#jwks = PLazy.from(loadJwks)
        throw new Error('Remote unavailable', {cause})
      }
    }
    this.#jwks = PLazy.from(loadJwks)
  }

  get #redirectUri(): URL {
    const url = new URL(this.#context.handlerUrl)
    url.searchParams.set('auth', 'login')
    return url
  }

  async authenticate(request: Request): Promise<Response> {
    try {
      const [ctx] = await outcome(this.verify(request))
      const url = new URL(request.url)
      const action = url.searchParams.get('auth')
      const redirectUri = this.#redirectUri
      switch (action) {
        case AuthAction.Status: {
          if (ctx)
            return Response.json({
              type: AuthResultType.Authenticated,
              user: ctx.user
            })
          const codeVerifier = await generateCodeVerifier()
          const state = createId()
          const redirectUrl =
            await this.#client.authorizationCode.getAuthorizeUri({
              redirectUri: redirectUri.toString(),
              state,
              codeVerifier
            })
          return Response.json(
            {
              type: AuthResultType.UnAuthenticated,
              redirect: redirectUrl
            },
            {
              headers: {
                'set-cookie': router.cookie({
                  name: COOKIE_VERIFIER,
                  value: codeVerifier,
                  path: redirectUri.pathname,
                  secure: redirectUri.protocol === 'https:',
                  httpOnly: true,
                  sameSite: 'strict'
                })
              }
            }
          )
        }
        case AuthAction.Login: {
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')
          if (!code || !state)
            throw new HttpError(400, 'Missing code or state parameter')
          const cookieHeader = request.headers.get('cookie')
          if (!cookieHeader) throw new HttpError(400, 'Missing cookies')
          const {[COOKIE_VERIFIER]: codeVerifier} = parse(cookieHeader)
          if (!codeVerifier)
            throw new HttpError(400, 'Missing code verifier cookie')
          const token = await this.#client.authorizationCode.getToken({
            redirectUri: redirectUri.toString(),
            code,
            codeVerifier
          })
          assert(token.refreshToken, 'Missing refresh token in response')

          const config = this.#config
          let dashboardPath = config.dashboardFile ?? '/admin.html'
          if (!dashboardPath.startsWith('/'))
            dashboardPath = `/${dashboardPath}`
          const dashboardUrl = new URL(dashboardPath, url)
          return router.redirect(dashboardUrl, {
            headers: {
              'set-cookie': tokenToCookie(token, redirectUri)
            }
          })
        }
        default:
          return new Response('Bad request', {status: 400})
      }
    } catch (error) {
      if (error instanceof HttpError)
        return new Response(error.message, {status: error.code})
      return Response.json(
        error instanceof Error ? error.message : 'Unknown error',
        {status: 401}
      )
    }
  }

  async verify(request: Request): Promise<AuthedContext> {
    const ctx = this.#context
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) throw new MissingCredentialsError('Missing cookies')
    const {
      [COOKIE_ACCESS_TOKEN]: accessToken,
      [COOKIE_REFRESH_TOKEN]: refreshToken
    } = parse(cookieHeader)
    const jwks = await this.#jwks
    try {
      if (!accessToken)
        throw new MissingCredentialsError('Missing access token cookie')
      const key = selectKey(jwks, accessToken)
      const user = await verify<User & {exp: number}>(accessToken, key)
      const expiresSoon = user.exp - Math.floor(Date.now() / 1000) < 30
      if (expiresSoon && refreshToken)
        throw new InvalidCredentialsError('Access token will expire soon') // Trigger refresh
      return {...ctx, user, token: accessToken}
    } catch (error) {
      if (!refreshToken) throw error
      const key = selectKey(jwks, refreshToken)
      const [, failed] = await outcome(verify(refreshToken, key))
      if (failed)
        throw new InvalidCredentialsError('Invalid refresh token', {
          cause: [failed, error]
        })
      // Refresh token is valid, but access token is not
      const token = {accessToken, refreshToken, expiresAt: null}
      const newToken = await this.#client.refreshToken(token).catch(cause => {
        throw new InvalidCredentialsError('Failed to refresh token', {
          cause: [cause, error]
        })
      })
      const user = await verify<User>(newToken.accessToken, key, {
        clockTolerance: 30
      }).catch(cause => {
        throw new InvalidCredentialsError('Failed to verify user', {
          cause: [cause, error]
        })
      })
      const redirectUri = this.#redirectUri
      return {
        ...ctx,
        user,
        token: newToken.accessToken,
        transformResponse(response: Response): Response {
          const result = response.clone()
          result.headers.append(
            'set-cookie',
            tokenToCookie(newToken, redirectUri)
          )
          return result
        }
      }
    }
  }
}

function selectKey(
  jwks: Array<JsonWebKey & {kid: string}>,
  token: string
): JsonWebKey {
  const kid = decode(token).header.kid
  if (!kid) return jwks[0]
  const key = jwks.find(k => k.kid === kid)
  if (!key) throw new Error(`No key found for kid: ${kid}`)
  return key
}

function unauthorized(message = 'Unauthorized') {
  return new Response(message, {status: 401})
}

function tokenToCookie(token: OAuth2Token, redirectUri: URL): string {
  assert(token.refreshToken, 'Missing access token in response')
  return router.cookie(
    {
      name: COOKIE_ACCESS_TOKEN,
      value: token.accessToken,
      expires: token.expiresAt ? new Date(token.expiresAt) : undefined,
      path: redirectUri.pathname,
      secure: redirectUri.protocol === 'https:',
      httpOnly: true,
      sameSite: 'strict'
    },
    {
      name: COOKIE_REFRESH_TOKEN,
      value: token.refreshToken,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      path: redirectUri.pathname,
      secure: redirectUri.protocol === 'https:',
      httpOnly: true,
      sameSite: 'strict'
    }
  )
}
