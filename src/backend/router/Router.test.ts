import {Request, Response} from '@alinea/iso'
import {suite} from '@alinea/suite'
import {router} from 'alinea/backend/router/Router'

const matcher = router.matcher()

const {handle} = router(
  matcher.get('/').map(() => undefined),
  matcher.get('/').map(() => new Response('root')),
  matcher.get('/param/:id').map(({params}) => new Response(params.id as string))
)

const test = suite(import.meta)

test('root', async () => {
  const response = await handle(new Request('http://localhost'))
  test.is(await response?.text(), 'root')
})

test('param', async () => {
  const response = await handle(new Request('http://localhost/param/123'))
  test.is(await response?.text(), '123')
})
