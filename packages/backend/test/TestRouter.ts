import {createMatcher, createRouter} from '@alinea/backend/router/Router'
import {Request, Response} from '@web-std/fetch'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const matcher = createMatcher()

const {handle} = createRouter(
  matcher.get('/').map(() => undefined),
  matcher.get('/').map(() => new Response('root')),
  matcher.get('/param/:id').map(({params}) => new Response(params.id as string))
)

test('root', async () => {
  const response = await handle(new Request('http://localhost'))
  assert.is(await response?.text(), 'root')
})

test('param', async () => {
  const response = await handle(new Request('http://localhost/param/123'))
  assert.is(await response?.text(), '123')
})

test.run()
