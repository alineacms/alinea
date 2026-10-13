import {suite} from '@alinea/suite'
import {BasicAuth} from './BasicAuth.js'

const test = suite(import.meta)

const context = {
  apiKey: 'key',
  handlerUrl: new URL('https://cms.example.com/api'),
  isDev: false
}

function request(credentials: string): Request {
  return new Request('https://cms.example.com/api', {
    headers: {authorization: `Basic ${btoa(credentials)}`}
  })
}

test('passwords keep their colons', async () => {
  const received: Array<[string, string]> = []
  const auth = new BasicAuth(context, (username, password) => {
    received.push([username, password])
    return password === 'se:cr:et'
  })
  const {user} = await auth.verify(request('ada:se:cr:et'))
  test.is(user.sub, 'ada')
  test.equal(received, [['ada', 'se:cr:et']])
})

test('credentials without a colon are invalid', async () => {
  let calls = 0
  const auth = new BasicAuth(context, () => {
    calls++
    return true
  })
  await test.throws(() => auth.verify(request('ada')), 'Invalid credentials')
  test.is(calls, 0)
})
