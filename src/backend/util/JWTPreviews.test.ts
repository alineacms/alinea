import {decode, sign} from '#/core/util/JWT.js'
import {suite} from '@alinea/suite'
import {JWTPreviews} from './JWTPreviews.js'

const test = suite(import.meta)

test('creates a short-lived preview session token', async () => {
  const now = Math.floor(Date.now() / 1000)
  const token = await new JWTPreviews('preview-secret').sign()
  const preview = decode(token).payload

  test.equal(preview.purpose, 'preview')
  test.ok(typeof preview.iat === 'number' && preview.iat >= now)
  test.equal(Number(preview.exp) - Number(preview.iat), 300)
  await new JWTPreviews('preview-secret').verify(token)
})

test('rejects tokens that were not issued for a preview session', async () => {
  const now = Math.floor(Date.now() / 1000)
  const token = await sign(
    {purpose: 'other', iat: now, exp: now + 300},
    'preview-secret'
  )

  await test.throws(
    () => new JWTPreviews('preview-secret').verify(token),
    'Invalid preview token'
  )
})
