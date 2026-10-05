import {nextMocks} from '#test/NextMocks.js'
import {Config} from '#/index.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {sign} from '#/core/util/JWT.js'
import {EntryStore} from '#/database/EntryStore.js'
import {
  developmentKeyHeader,
  forwardedMutationHeader
} from '#/core/Connection.js'
import {afterEach, beforeEach, expect, spyOn, test} from 'bun:test'

const apiKey = 'preview-secret'

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

test('runs the commit hooks around mutations the dev server forwards', async () => {
  const received: Array<{
    action: string | null
    body: unknown
    cookie: string | null
    key: string | null
    forwarded: string | null
  }> = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const cookie = request.headers.get('cookie')
      // The hooks receive the user the dev server signs in
      if (new URL(request.url).searchParams.get('action') === 'user')
        return Response.json({sub: 'dev', roles: ['editor']})
      received.push({
        action: new URL(request.url).searchParams.get('action'),
        body: await request.json(),
        cookie,
        key: request.headers.get(developmentKeyHeader),
        forwarded: request.headers.get(forwardedMutationHeader)
      })
      if (cookie === 'alinea.session=reader')
        return new Response(
          JSON.stringify({success: false, error: 'Not allowed'}),
          {status: 403, headers: {'content-type': 'application/json'}}
        )
      return new Response(JSON.stringify({sha: 'committed'}), {
        headers: {'content-type': 'application/json'}
      })
    }
  })
  const hooks: Array<unknown> = []
  const devHandle = createHandlerWithDatabase(
    {
      cms,
      beforeCommit({mutations, user}) {
        hooks.push(['before', mutations.length, user.roles])
        return [...mutations, ...mutations]
      },
      afterCommit({sha, user}) {
        hooks.push(['after', sha, user.roles])
      }
    },
    async () => {
      throw new Error('The dev server owns the database')
    }
  )
  const devHandlerUrl = new URL('/api', server.url)
  nextMocks.devHandlerUrl = devHandlerUrl
  try {
    const mutation = {op: 'remove', entryId: 'page'}
    const response = await devHandle(
      new Request('https://example.com/api/cms?action=mutate', {
        method: 'POST',
        headers: {
          cookie: 'alinea.session=1',
          'content-type': 'application/json',
          [developmentKeyHeader]: apiKey
        },
        body: JSON.stringify([mutation])
      })
    )
    expect(await response.json()).toEqual({sha: 'committed'})
    // The dev server commits what the hooks adjusted, for the same user.
    expect(received).toEqual([
      {
        action: 'mutate',
        body: [mutation, mutation],
        cookie: 'alinea.session=1',
        key: apiKey,
        // Marked so the dev server commits it instead of forwarding again.
        forwarded: 'true'
      }
    ])
    expect(hooks).toEqual([
      ['before', 1, ['editor']],
      ['after', 'committed', ['editor']]
    ])
    // The dev server answers everything else itself.
    const resolve = await devHandle(
      new Request('https://example.com/api/cms?action=resolve', {
        method: 'POST',
        body: '{}'
      })
    )
    expect(resolve.status).toBe(404)
    // Forwarded mutations carry the development key.
    const unsigned = await devHandle(
      new Request('https://example.com/api/cms?action=mutate', {
        method: 'POST',
        body: '[]'
      })
    )
    expect(unsigned.status).toBe(401)
    const malformed = await devHandle(
      new Request('https://example.com/api/cms?action=mutate', {
        method: 'POST',
        headers: {[developmentKeyHeader]: apiKey},
        body: 'not json'
      })
    )
    expect(malformed.status).toBe(400)
    expect(received).toHaveLength(1)
    // What the dev server rejects keeps its status, such as a missing role.
    const denied = await devHandle(
      new Request('https://example.com/api/cms?action=mutate', {
        method: 'POST',
        headers: {
          cookie: 'alinea.session=reader',
          [developmentKeyHeader]: apiKey
        },
        body: JSON.stringify([mutation])
      })
    )
    expect(denied.status).toBe(403)
    expect(await denied.json()).toMatchObject({success: false})
    expect(hooks).toHaveLength(3)
    // Media is served by the dev server, from the database it owns.
    const media = await devHandle(
      new Request('https://example.com/admin/file/company-a/photo.jpg')
    )
    expect(media.status).toBe(307)
    const location = new URL(media.headers.get('location')!)
    expect(location.origin + location.pathname).toBe(devHandlerUrl.href)
    expect(Object.fromEntries(location.searchParams)).toEqual({
      file: 'company-a/photo.jpg',
      delivery: 'proxy'
    })
  } finally {
    nextMocks.devHandlerUrl = undefined
    server.stop(true)
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
  nextMocks.draftMode = false
  nextMocks.enableCalls = 0
  nextMocks.cookies = []
  nextMocks.handlerUrl = new URL('https://example.com/api/cms')
  nextMocks.devHandlerUrl = undefined
  nextMocks.apiKey = apiKey
  consoleError = spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

test('rejects an invalid preview token without a draft session', async () => {
  const response = await previewRequest('invalid')

  expect(response.status).toBe(500)
  expect(response.headers.get('location')).toBeNull()
  expect(nextMocks.enableCalls).toBe(0)
})

test('accepts an expired preview token with an existing draft session', async () => {
  nextMocks.draftMode = true
  const response = await previewRequest(await expiredToken(), '/articles/one')

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe(
    'https://example.com/articles/one'
  )
  expect(nextMocks.enableCalls).toBe(1)
})

test.each([false, true])(
  'rejects cross-origin preview redirects when draft mode is %s',
  async isDraftEnabled => {
    nextMocks.draftMode = isDraftEnabled
    const token = isDraftEnabled ? await expiredToken() : await validToken()

    for (const returnTo of [
      '//evil.example/path',
      'https://evil.example/path'
    ]) {
      const response = await previewRequest(token, returnTo)
      expect(response.status).toBe(500)
      expect(response.headers.get('location')).toBeNull()
    }
    expect(nextMocks.enableCalls).toBe(0)
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
