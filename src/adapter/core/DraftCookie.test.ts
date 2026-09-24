import {sign} from '#/core/util/JWT.js'
import {expect, test} from 'bun:test'
import {DRAFT_COOKIE_NAME, draftCookie, hasDraftCookie} from './DraftCookie.js'

const apiKey = 'draft-secret'

function cookieOf(header: string) {
  const [pair] = header.split(';')
  const index = pair.indexOf('=')
  return {name: pair.slice(0, index), value: pair.slice(index + 1)}
}

test('accepts the cookie it set', async () => {
  const header = await draftCookie(apiKey, true)
  const cookie = cookieOf(header)

  expect(cookie.name).toBe(DRAFT_COOKIE_NAME)
  expect(header).toContain('Path=/')
  expect(header).toContain('HttpOnly')
  expect(header).toContain('SameSite=None; Secure')
  expect(await hasDraftCookie([cookie], apiKey)).toBe(true)
})

test('uses SameSite=Lax without https', async () => {
  const header = await draftCookie(apiKey, false)

  expect(header).toContain('SameSite=Lax')
  expect(header).not.toContain('Secure')
})

test('rejects a cookie signed with another key', async () => {
  const cookie = cookieOf(await draftCookie('another-secret', true))

  expect(await hasDraftCookie([cookie], apiKey)).toBe(false)
})

test('rejects expired, foreign and garbage tokens', async () => {
  const now = Math.floor(Date.now() / 1000)
  const expired = await sign(
    {purpose: 'draft', iat: now - 60, exp: now - 1},
    apiKey
  )
  const preview = await sign(
    {purpose: 'preview', iat: now, exp: now + 60},
    apiKey
  )
  for (const value of [expired, preview, 'garbage', ''])
    expect(
      await hasDraftCookie([{name: DRAFT_COOKIE_NAME, value}], apiKey)
    ).toBe(false)
  expect(await hasDraftCookie([], apiKey)).toBe(false)
})
