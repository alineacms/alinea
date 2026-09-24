import {afterAll, afterEach, beforeAll, expect, test} from 'bun:test'
import {devProxy} from './DevProxy.js'

const env = {
  devServer: process.env.ALINEA_DEV_SERVER,
  adminPath: process.env.ALINEA_ADMIN_PATH
}

let server: ReturnType<typeof Bun.serve>
let closeStream: (() => void) | undefined

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === '/admin/~dev') {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(': connected\n\n'))
            closeStream = () => controller.close()
          }
        })
        return new Response(stream, {
          headers: {'content-type': 'text/event-stream'}
        })
      }
      if (url.pathname === '/admin/moved')
        return new Response(null, {status: 302, headers: {location: '/x'}})
      return Response.json({
        method: request.method,
        url: `${url.pathname}${url.search}`,
        headers: Object.fromEntries(request.headers),
        body: await request.text()
      })
    }
  })
})

afterAll(() => {
  server.stop(true)
})

function enable() {
  process.env.ALINEA_DEV_SERVER = `http://localhost:${server.port}`
  process.env.ALINEA_ADMIN_PATH = '/admin'
}

afterEach(() => {
  if (env.devServer === undefined) delete process.env.ALINEA_DEV_SERVER
  else process.env.ALINEA_DEV_SERVER = env.devServer
  if (env.adminPath === undefined) delete process.env.ALINEA_ADMIN_PATH
  else process.env.ALINEA_ADMIN_PATH = env.adminPath
})

async function echo(request: Request) {
  const response = await devProxy(request)
  if (!response) throw new Error('Expected the request to be proxied')
  return response.json()
}

test('inactive outside the Alinea CLI', () => {
  delete process.env.ALINEA_DEV_SERVER
  delete process.env.ALINEA_ADMIN_PATH
  expect(devProxy(new Request('http://site.test/admin'))).toBeUndefined()
})

test('only proxies the admin path', () => {
  enable()
  expect(devProxy(new Request('http://site.test/'))).toBeUndefined()
  expect(
    devProxy(new Request('http://site.test/administration'))
  ).toBeUndefined()
  expect(devProxy(new Request('http://site.test/api/cms'))).toBeUndefined()
})

test('maps the dashboard and files to the dev server', async () => {
  enable()
  expect((await echo(new Request('http://site.test/admin'))).url).toBe('/admin')
  expect(
    (await echo(new Request('http://site.test/admin/entry.js?123'))).url
  ).toBe('/admin/entry.js?123')
  const file = await echo(
    new Request('http://site.test/admin/file/media/a%20b.png')
  )
  expect(file.url).toBe('/api?file=media%2Fa+b.png&delivery=proxy')
})

test('forwards the request and tells the dev server where it came from', async () => {
  enable()
  const request = new Request('https://site.test/admin/api?action=mutate', {
    method: 'POST',
    headers: {cookie: 'a=1', 'accept-encoding': 'gzip'},
    body: 'mutation'
  })
  const echoed = await echo(request)
  expect(echoed.method).toBe('POST')
  expect(echoed.body).toBe('mutation')
  expect(echoed.headers.cookie).toBe('a=1')
  expect(echoed.headers['accept-encoding']).toBe('identity')
  expect(echoed.headers.host).toBe(`localhost:${server.port}`)
  expect(echoed.headers['x-forwarded-host']).toBe('site.test')
  expect(echoed.headers['x-forwarded-proto']).toBe('https')
})

test('passes redirects on', async () => {
  enable()
  const response = await devProxy(new Request('http://site.test/admin/moved'))
  expect(response!.status).toBe(302)
  expect(response!.headers.get('location')).toBe('/x')
})

test('streams the event stream while it is open', async () => {
  enable()
  const response = await devProxy(new Request('http://site.test/admin/~dev'))
  const reader = response!.body!.getReader()
  const first = await reader.read()
  expect(new TextDecoder().decode(first.value)).toBe(': connected\n\n')
  closeStream!()
  expect((await reader.read()).done).toBe(true)
})
