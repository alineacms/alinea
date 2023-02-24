import {Request, Response} from '@alinea/iso'
import {router} from 'alinea/backend/router/Router'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const matcher = router.matcher()

const {handle} = router(
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
