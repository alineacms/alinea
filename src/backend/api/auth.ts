import {BasicAuth, type Verifier} from './BasicAuth.js'
import type {BackendPart} from './CreateBackend.js'
import {OAuth2, type OAuth2Options} from './OAuth2.js'

export function basic(verify: Verifier): BackendPart {
  return context => new BasicAuth(context, verify)
}

export function oauth2(options: OAuth2Options): BackendPart {
  return (context, config) => new OAuth2(context, config, options)
}
