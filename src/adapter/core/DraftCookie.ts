import {sign, verify} from '#/core/util/JWT.js'
import {isRecord} from '#/core/util/Objects.js'
import type {HostCookie} from './ServerHost.js'

/** Allows drafts for a browser session on hosts without a native draft mode. */
export const DRAFT_COOKIE_NAME = '@a/d'
const draftLifetime = 24 * 60 * 60

/** The Set-Cookie header value that allows drafts, its token lasts a day. */
export async function draftCookie(
  apiKey: string,
  secure: boolean
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const token = await sign(
    {purpose: 'draft', iat: issuedAt, exp: issuedAt + draftLifetime},
    apiKey
  )
  // Like Next's draft mode cookie: SameSite=None keeps it in a preview frame
  // embedded from another site, which browsers only allow over https.
  const sameSite = secure ? 'SameSite=None; Secure' : 'SameSite=Lax'
  return `${DRAFT_COOKIE_NAME}=${token}; Path=/; HttpOnly; ${sameSite}`
}

export async function hasDraftCookie(
  cookies: Array<HostCookie>,
  apiKey: string
): Promise<boolean> {
  const cookie = cookies.find(cookie => cookie.name === DRAFT_COOKIE_NAME)
  if (!cookie) return false
  try {
    const payload = await verify(cookie.value, apiKey)
    return isRecord(payload) && payload.purpose === 'draft'
  } catch {
    return false
  }
}
