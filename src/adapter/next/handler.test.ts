import {Config} from '#/index.js'
import {sign} from '#/core/util/JWT.js'
import {afterEach, beforeEach, expect, mock, spyOn, test} from 'bun:test'

const apiKey = 'preview-secret'
let draftEnabled = false
let enableCalls = 0

mock.module('./context.js', () => ({
  requestContext: async () => ({
    isDev: false,
    handlerUrl: new URL('https://example.com/api/cms'),
    apiKey
  })
}))

mock.module('next/headers', () => ({
  draftMode: async () => ({
    get isEnabled() {
      return draftEnabled
    },
    enable() {
      enableCalls += 1
    }
  })
}))

const [{createCMS}, {createHandler, handlerPathname}] = await Promise.all([
  import('./cms.js'),
  import('./handler.js')
])

const Page = Config.document('Page', {fields: {}})
const cms = createCMS({
  baseUrl: 'https://example.com',
  handlerUrl: '/api/cms',
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})
const handle = createHandler(cms)
let consoleError: ReturnType<typeof spyOn>

test('uses the exact pathname of an absolute handler URL', () => {
  const config = {
    ...cms.config,
    handlerUrl: 'https://example.com/api/custom'
  }
  const expected = handlerPathname(config, new URL('http://localhost/request'))

  expect(expected).toBe('/api/custom')
  expect('/api/custom-extra').not.toBe(expected)
})

beforeEach(() => {
  draftEnabled = false
  enableCalls = 0
  consoleError = spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

test('rejects an invalid preview token without a draft session', async () => {
  const response = await previewRequest('invalid')

  expect(response.status).toBe(500)
  expect(response.headers.get('location')).toBeNull()
  expect(enableCalls).toBe(0)
})

test('accepts an expired preview token with an existing draft session', async () => {
  draftEnabled = true
  const response = await previewRequest(await expiredToken(), '/articles/one')

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe(
    'https://example.com/articles/one'
  )
  expect(enableCalls).toBe(1)
})

test.each([false, true])(
  'rejects cross-origin preview redirects when draft mode is %s',
  async isDraftEnabled => {
    draftEnabled = isDraftEnabled
    const token = isDraftEnabled ? await expiredToken() : await validToken()

    for (const returnTo of [
      '//evil.example/path',
      'https://evil.example/path'
    ]) {
      const response = await previewRequest(token, returnTo)
      expect(response.status).toBe(500)
      expect(response.headers.get('location')).toBeNull()
    }
    expect(enableCalls).toBe(0)
  }
)

function previewRequest(token: string, returnTo = '/'): Promise<Response> {
  const url = new URL('https://example.com/api/cms')
  url.searchParams.set('preview', token)
  url.searchParams.set('returnTo', returnTo)
  return handle(new Request(url))
}

function validToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign({purpose: 'preview', iat: now, exp: now + 60}, apiKey)
}

function expiredToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign({purpose: 'preview', iat: now - 60, exp: now - 1}, apiKey)
}
