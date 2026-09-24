import {nextMocks} from '#test/NextMocks.js'
import {createCMS} from '#/adapter/server/node.js'
import {Config} from '#/index.js'
import {beforeEach, expect, mock, test} from 'bun:test'
import {createMiddleware} from './middleware.js'

beforeEach(() => {
  nextMocks.handlerUrl = new URL('https://example.com/api/cms')
  nextMocks.apiKey = 'astro-secret'
})

const cms = createCMS(
  Config.create({
    baseUrl: 'https://example.com',
    handlerUrl: '/api/cms',
    schema: {},
    workspaces: {}
  })
)

function context(path: string, isPrerendered = false) {
  return {request: new Request(`https://example.com${path}`), isPrerendered}
}

test('alinea routes are answered before the page renders', async () => {
  const onRequest = createMiddleware(cms)
  const next = mock(async () => new Response('page'))
  const response = await onRequest(context('/admin'), next)
  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/admin.html')
  expect(next).not.toHaveBeenCalled()
})

test('pages render through next', async () => {
  const onRequest = createMiddleware({cms, previews: false})
  const next = mock(async () => new Response('page'))
  const response = await onRequest(context('/about'), next)
  expect(await response.text()).toBe('page')
  expect(next).toHaveBeenCalledTimes(1)
})

test('prerendered pages are left to Astro', async () => {
  const onRequest = createMiddleware(cms)
  const next = mock(async () => new Response('page'))
  // Prerendered requests have no headers, not even for Alinea routes
  const response = await onRequest(context('/admin', true), next)
  expect(await response.text()).toBe('page')
})
