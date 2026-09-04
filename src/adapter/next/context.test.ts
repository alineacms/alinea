import {developmentKeyHeader} from '#/core/Connection.js'
import {Headers, Request} from '@alinea/iso'
import {suite} from '@alinea/suite'
import {forwardDevelopmentCredentials} from './ForwardCredentials.js'

const test = suite(import.meta)

test('forwards request credentials separately from the development key', () => {
  const request = new Request('http://localhost/api/custom', {
    headers: {
      authorization: 'Basic original-credentials',
      cookie: 'alinea.access_token=access; alinea.refresh_token=refresh'
    }
  })
  const init = forwardDevelopmentCredentials(request, 'internal-key', {
    headers: {'x-existing': 'preserved'}
  })
  const headers = new Headers(init.headers)

  test.is(headers.get('authorization'), 'Basic original-credentials')
  test.is(
    headers.get('cookie'),
    'alinea.access_token=access; alinea.refresh_token=refresh'
  )
  test.is(headers.get(developmentKeyHeader), 'internal-key')
  test.is(headers.get('x-existing'), 'preserved')
})
