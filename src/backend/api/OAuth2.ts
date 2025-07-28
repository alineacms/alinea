import {type Request, Response} from '@alinea/iso'
import {OAuth2Client} from '@badgateway/oauth2-client'
import {AuthResultType} from 'alinea/cloud/AuthResult.js'
import type {
  AuthApi,
  AuthedContext,
  RequestContext
} from 'alinea/core/Connection'
import {HttpError} from 'alinea/core/HttpError'
import type {User} from 'alinea/core/User'
import {verify} from 'alinea/core/util/JWT'
import PLazy from 'p-lazy'
import {AuthAction} from '../Auth.js'

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
    if (!auth) throw unauthorized('Missing Authorization header')
    const [scheme, token] = auth.split(' ', 2)
    if (scheme !== 'Bearer') throw unauthorized('Expected Bearer token')
    const user = await verify<User>(token, await this.#publicKey)
    return {
      ...ctx,
      user,
      token
    }
  }
}

function unauthorized(message = 'Unauthorized') {
  return new Response(message, {status: 401})
}
