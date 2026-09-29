import {suite} from '@alinea/suite'
import {proxyMediaUrl} from './ProxyMedia.js'

const test = suite(import.meta)

test('forwards cookies only to the origin of the request', async () => {
  const originalFetch = globalThis.fetch
  const cookies: Array<string | null> = []
  globalThis.fetch = Object.assign(
    async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      cookies.push(new Headers(init?.headers).get('cookie'))
      return new Response('bytes')
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const request = new Request('https://preview.vercel.app/api?file=a.jpg', {
      headers: {cookie: '_vercel_jwt=token'}
    })
    await proxyMediaUrl(request, new URL('https://preview.vercel.app/a.jpg'))
    await proxyMediaUrl(request, new URL('https://storage.example.com/a.jpg'))
    test.equal(cookies, ['_vercel_jwt=token', null])
  } finally {
    globalThis.fetch = originalFetch
  }
})
