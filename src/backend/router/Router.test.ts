import {DecompressionStream, Request, Response} from '@alinea/iso'
import {suite} from '@alinea/suite'
import {compressResponse, router} from '#/backend/router/Router.js'

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

test('compresses a response when the request accepts gzip', async () => {
  const request = new Request('http://localhost', {
    headers: {'accept-encoding': 'gzip, deflate'}
  })
  const response = compressResponse(request, new Response('hello'))

  test.is(response.headers.get('content-encoding'), 'gzip')
  test.is(response.headers.get('vary'), 'accept-encoding')
  test.is(response.headers.get('content-length'), null)

  const decompressed = response.body?.pipeThrough(
    new DecompressionStream('gzip')
  )
  test.is(await new Response(decompressed).text(), 'hello')
})
