import {nextMocks} from '#test/NextMocks.js'
import {draftCookie} from '#/adapter/core/DraftCookie.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Config} from '#/index.js'
import {beforeEach, expect, mock, spyOn, test} from 'bun:test'
import PLazy from 'p-lazy'
import {createMiddleware, type PreviewsOptions} from './Middleware.js'
import {createCMS} from './node.js'

const apiKey = 'middleware-secret'
const page = '<!DOCTYPE html><html><body><p>Hello</p></body></html>'

beforeEach(() => {
  nextMocks.handlerUrl = new URL('https://example.com/api/cms')
  nextMocks.apiKey = apiKey
})

function testCMS() {
  const resolve = mock(async (query: GraphQuery) => query)
  const db = {
    sha: 'content-hash',
    syncWith: async () => 'content-hash',
    resolve
  }
  const cms = createCMS(
    Config.create({
      baseUrl: 'https://example.com',
      handlerUrl: '/api/cms',
      schema: {},
      workspaces: {}
    })
  )
  cms.bundledDb = PLazy.from(async () => db as unknown as LocalStore)
  return {cms, resolve}
}

async function draftRequest(path: string) {
  const cookie = await draftCookie(apiKey, true)
  const [pair] = cookie.split(';')
  return new Request(`https://example.com${path}`, {headers: {cookie: pair}})
}

function htmlPage() {
  return new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-length': String(page.length)
    }
  })
}

test('alinea routes are answered by the handler', async () => {
  const {cms} = testCMS()
  const middleware = createMiddleware(cms)
  const next = mock(async () => new Response('page'))

  const admin = await middleware(
    new Request('https://example.com/admin?x=1'),
    next
  )
  expect(admin.status).toBe(302)
  expect(admin.headers.get('location')).toBe('/admin.html?x=1')

  // Without a generated database the handler answers with an error
  const error = spyOn(console, 'error').mockImplementation(() => {})
  try {
    await middleware(new Request('https://example.com/api/cms'), next)
    await middleware(
      new Request('https://example.com/admin/file/image.png'),
      next
    )
  } finally {
    error.mockRestore()
  }
  expect(next).not.toHaveBeenCalled()

  // Files are only read, uploads go through the handler path
  const post = new Request('https://example.com/admin/file/image.png', {
    method: 'POST'
  })
  expect(await (await middleware(post, next)).text()).toBe('page')
  expect(next).toHaveBeenCalledTimes(1)
})

test('other requests render within the request', async () => {
  const {cms, resolve} = testCMS()
  const middleware = createMiddleware(cms)
  const request = await draftRequest('/page')

  await middleware(request, async () => {
    await cms.resolve({disableSync: true})
    return new Response('page')
  })

  expect(resolve.mock.calls[0][0].status).toBe('preferDraft')
})

test('draft pages load the previews client', async () => {
  const {cms} = testCMS()
  const middleware = createMiddleware(cms)

  const response = await middleware(await draftRequest('/page'), async () =>
    htmlPage()
  )

  expect(response.headers.get('content-length')).toBeNull()
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
  expect(await response.text()).toBe(
    '<!DOCTYPE html><html><body><p>Hello</p>' +
      '<script src="/admin/previews.js" data-dashboard-url="https://example.com/admin.html" defer></script>' +
      '</body></html>'
  )
})

test('the widget receives the render stats', async () => {
  const {cms} = testCMS()
  const previews: PreviewsOptions = {widget: true, stats: true, root: 'a"b'}
  const middleware = createMiddleware({cms, previews})

  const response = await middleware(await draftRequest('/page'), async () => {
    await cms.resolve({disableSync: true})
    return htmlPage()
  })

  const html = await response.text()
  expect(html).toContain(' data-widget="" ')
  expect(html).toContain(' data-root="a&quot;b" ')
  const stats = html.match(/data-stats="([^"]*)"/)![1].replaceAll('&quot;', '"')
  expect(JSON.parse(stats).rows).toHaveLength(1)
})

test('published pages and other content are left alone', async () => {
  const {cms} = testCMS()
  const middleware = createMiddleware(cms)
  const published = htmlPage()
  const json = Response.json({})

  expect(
    await middleware(
      new Request('https://example.com/page'),
      async () => published
    )
  ).toBe(published)
  expect(await middleware(await draftRequest('/data'), async () => json)).toBe(
    json
  )

  const disabled = createMiddleware({cms, previews: false})
  const draft = htmlPage()
  expect(await disabled(await draftRequest('/page'), async () => draft)).toBe(
    draft
  )
})
