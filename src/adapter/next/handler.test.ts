import {Config} from '#/index.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {sign} from '#/core/util/JWT.js'
import {EntryStore} from '#/database/EntryStore.js'
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

const [{createCMS}, {createHandlerWithDatabase, handlerPathname}] =
  await Promise.all([import('./cms.js'), import('./handler.js')])

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
const handle = createHandlerWithDatabase(cms, async () => {
  throw new Error('Test handler should not open a database')
})
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

test('reconstructs a rewritten media request from its public pathname', async () => {
  const previousDevServer = process.env.ALINEA_DEV_SERVER
  process.env.ALINEA_DEV_SERVER = 'https://example.com'
  const mediaHandle = createHandlerWithDatabase(cms, () =>
    EntryStore.memory(cms.config, new MemorySource())
  )
  try {
    const response = await mediaHandle(
      new Request(
        'https://example.com/admin/file/company-a/missing.jpg?version=123'
      )
    )

    expect(response.status).toBe(404)
  } finally {
    if (previousDevServer === undefined) delete process.env.ALINEA_DEV_SERVER
    else process.env.ALINEA_DEV_SERVER = previousDevServer
  }
})

test('rejects an unrelated pathname with media query parameters', async () => {
  const response = await handle(
    new Request(
      'https://example.com/not-the-file-route?file=company-a%2Fmissing.jpg&delivery=proxy'
    )
  )

  expect(response.status).toBe(400)
  expect(await response.text()).toBe(
    'Expected handler to be served on /api/cms'
  )
})

test('rejects non-read requests on the public media pathname', async () => {
  const response = await handle(
    new Request('https://example.com/admin/file/company-a/example.jpg', {
      method: 'POST'
    })
  )

  expect(response.status).toBe(400)
  expect(await response.text()).toBe(
    'Expected handler to be served on /api/cms'
  )
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
