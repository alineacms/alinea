import {type Request, Response} from '@alinea/iso'
import {generateCodeVerifier, OAuth2Client} from '@badgateway/oauth2-client'
import {AuthResultType} from 'alinea/cloud/AuthResult'
import type {
  AuthApi,
  AuthedContext,
  RequestContext
} from 'alinea/core/Connection'
import {HttpError} from 'alinea/core/HttpError'
import {createId} from 'alinea/core/Id'
import {outcome} from 'alinea/core/Outcome'
import type {User} from 'alinea/core/User'
import {verify} from 'alinea/core/util/JWT'
import {parse} from 'cookie-es'
import PLazy from 'p-lazy'
import {AuthAction} from '../Auth.js'
import {router} from '../router/Router.js'

type JWKS = {keys: Array<JsonWebKey>}

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

const COOKIE_VERIFIER = 'codeVerifier'
const COOKIE_ACCESS_TOKEN = 'accessToken'
const COOKIE_REFRESH_TOKEN = 'refreshToken'

export class OAuth2 implements AuthApi {
  #context: RequestContext
  #client: OAuth2Client
  #publicKey: Promise<JsonWebKey>

  constructor(context: RequestContext, options: OAuth2Options) {
    this.#context = context
    this.#client = new OAuth2Client(options)
    const loadPublicKey = async (): Promise<JsonWebKey> => {
      try {
        const res = await fetch(options.jwksUri)
        if (res.status !== 200)
          throw new HttpError(res.status, await res.text())
        const jwks: JWKS = await res.json()
        const key = jwks.keys.find(
          key => key.use === 'sig' && key.kty === 'RSA' && key.alg === 'RS256'
        )
        if (!key) throw new HttpError(500, 'No signature key found')
        return key
      } catch (cause) {
        this.#publicKey = PLazy.from(loadPublicKey)
        throw new Error('Remote unavailable', {cause})
      }
    }
    this.#publicKey = PLazy.from(loadPublicKey)
  }

  async authenticate(request: Request): Promise<Response> {
    const [ctx] = await outcome(this.verify(request))
    const url = new URL(request.url)
    const action = url.searchParams.get('auth')
    const redirectUri = new URL('?auth=login', this.#context.handlerUrl)
    switch (action) {
      case AuthAction.Status: {
        if (ctx)
          return Response.json({
            type: AuthResultType.Authenticated,
            user: ctx.user
          })
        const codeVerifier = await generateCodeVerifier()
        const state = createId()
        const url = await this.#client.authorizationCode.getAuthorizeUri({
          redirectUri: redirectUri.toString(),
          state,
          codeVerifier
        })
        return Response.json(
          {
            type: AuthResultType.UnAuthenticated,
            redirect: url
          },
          {
            headers: {
              'set-cookie': router.cookie({
                name: COOKIE_VERIFIER,
                value: codeVerifier,
                domain: redirectUri.hostname,
                path: '/',
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
        const token = await this.#client.authorizationCode.getToken({
          redirectUri: redirectUri.toString(),
          code,
          codeVerifier
        })
        if (!token.refreshToken)
          throw new HttpError(400, 'Missing refresh token in response')
        const user = await verify<User>(
          token.accessToken,
          await this.#publicKey
        )
        return Response.json(
          {
            type: AuthResultType.Authenticated,
            user
          },
          {
            headers: {
              'set-cookie': router.cookie(
                {
                  name: COOKIE_ACCESS_TOKEN,
                  value: token.accessToken,
                  expires: token.expiresAt
                    ? new Date(token.expiresAt)
                    : undefined,
                  domain: redirectUri.hostname,
                  path: '/',
                  secure: redirectUri.protocol === 'https:',
                  httpOnly: true,
                  sameSite: 'strict'
                },
                {
                  name: COOKIE_REFRESH_TOKEN,
                  value: token.refreshToken,
                  domain: redirectUri.hostname,
                  path: '/',
                  secure: redirectUri.protocol === 'https:',
                  httpOnly: true,
                  sameSite: 'strict'
                }
              )
            }
          }
        )
      }
      default:
        return new Response('Bad request', {status: 400})
    }
  }

  async verify(request: Request): Promise<AuthedContext> {
    const ctx = this.#context
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) throw unauthorized('Missing cookies')
    const {[COOKIE_ACCESS_TOKEN]: accessToken} = parse(cookieHeader)
    const user = await verify<User>(accessToken, await this.#publicKey)
    return {
      ...ctx,
      user,
      token: accessToken
    }
  }
}

function unauthorized(message = 'Unauthorized') {
  return new Response(message, {status: 401})
}
