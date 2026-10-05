import {jwks, type WebKey} from '#/backend/util/JWKS.js'
import {HttpError} from '#/core/HttpError.js'
import {decode, verify} from '#/core/util/JWT.js'
import {isRecord} from '#/core/util/Objects.js'
import {cloudConfig} from './CloudConfig.js'

interface VerifyCloudHandshakeOptions {
  clientId: string
  handshakeId: string
  origin: string
}

export class CloudHandshakeError extends Error {
  name = 'CloudHandshakeError'
}

export class CloudHandshakeServiceError extends Error {
  name = 'CloudHandshakeServiceError'
}

const verificationMessages: Record<string, string> = {
  'Invalid signature': 'Handshake token signature is invalid',
  'Token expired': 'Handshake token has expired',
  'Token not yet valid': 'Handshake token is not yet valid',
  'Invalid exp value': 'Handshake token expiration is invalid',
  'Invalid nbf value': 'Handshake token not-before claim is invalid'
}

export async function verifyCloudHandshake(
  token: string,
  options: VerifyCloudHandshakeOptions
): Promise<void> {
  const {header} = decodeHandshakeToken(token)
  if (
    !isRecord(header) ||
    header.alg !== 'RS256' ||
    typeof header.kid !== 'string' ||
    !header.kid
  )
    throw new CloudHandshakeError('Handshake token header is invalid')
  const key = (await cloudKeys(header.kid)).find(key => key.kid === header.kid)
  if (!key)
    throw new CloudHandshakeError('Handshake token signing key is unknown')
  const payload = await verify(token, key, {algorithms: ['RS256']}).catch(
    cause => {
      throw verificationError(cause)
    }
  )
  if (!isRecord(payload))
    throw new CloudHandshakeError('Handshake token payload is invalid')
  assertClaim('purpose', payload.purpose, 'handshake')
  assertClaim('ID', payload.handshake_id, options.handshakeId)
  assertClaim('audience', payload.aud, options.clientId)
  assertClaim('issuer', payload.iss, normalizedCloudUrl())
  assertClaim('origin', payload.origin, options.origin)
  if (typeof payload.project !== 'string')
    throw new CloudHandshakeError('Handshake project claim is invalid')
  if (typeof payload.iat !== 'number')
    throw new CloudHandshakeError('Handshake issued-at claim is invalid')
  if (typeof payload.exp !== 'number')
    throw new CloudHandshakeError('Handshake expiration claim is invalid')
}

function assertClaim(name: string, received: unknown, expected: string): void {
  if (received !== expected)
    throw new CloudHandshakeError(
      `Handshake ${name} mismatch: expected ${expected}, received ${String(received)}`
    )
}

function decodeHandshakeToken(token: string): ReturnType<typeof decode> {
  try {
    return decode(token)
  } catch (cause) {
    throw new CloudHandshakeError('Handshake token is malformed', {cause})
  }
}

function verificationError(
  cause: unknown
): CloudHandshakeError | CloudHandshakeServiceError {
  const reason = cause instanceof Error && verificationMessages[cause.message]
  return reason
    ? new CloudHandshakeError(reason, {cause})
    : new CloudHandshakeServiceError('Could not verify handshake token', {
        cause
      })
}

async function cloudKeys(kid: string): Promise<Array<WebKey>> {
  try {
    return await jwks(cloudConfig.jwks, kid)
  } catch (cause) {
    throw new CloudHandshakeServiceError(
      cause instanceof HttpError
        ? `Could not load handshake signing keys: ${cause.code}`
        : 'Could not load handshake signing keys',
      {cause}
    )
  }
}

function normalizedCloudUrl(): string {
  return cloudConfig.url.replace(/\/$/, '')
}
