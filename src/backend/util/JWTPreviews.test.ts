import {suite} from '@alinea/suite'
import {JWTPreviews} from './JWTPreviews.js'

const test = suite(import.meta)

test('creates a short-lived preview session token', async () => {
  const now = Math.floor(Date.now() / 1000)
  const token = await new JWTPreviews('preview-secret').sign()
  const preview = await new JWTPreviews('preview-secret').verify(token)

  test.equal(preview.purpose, 'preview')
  test.ok(preview.issuedAt >= now)
  test.equal(preview.expiresAt - preview.issuedAt, 300)
})
