import {nextMocks} from '#test/NextMocks.js'
import {
  DRAFT_COOKIE_NAME,
  draftCookie,
  hasDraftCookie
} from '#/adapter/core/DraftCookie.js'
import {Client} from '#/core/Client.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {GraphQuery} from '#/core/Graph.js'
import {sign} from '#/core/util/JWT.js'
import {Config} from '#/index.js'
import {afterEach, beforeEach, expect, mock, spyOn, test} from 'bun:test'
import PLazy from 'p-lazy'
import {createCMS, createHandler} from './node.js'
import {withRequest} from './RequestHost.js'

const apiKey = 'server-secret'
const build = process.env.ALINEA_BUILD

beforeEach(() => {
  delete process.env.ALINEA_BUILD
  nextMocks.handlerUrl = new URL('https://example.com/api/cms')
  nextMocks.apiKey = apiKey
})

afterEach(() => {
  if (build === undefined) delete process.env.ALINEA_BUILD
  else process.env.ALINEA_BUILD = build
})

function testCMS() {
  const resolve = mock(async (query: GraphQuery) => query)
  const syncWith = mock(async () => 'content-hash')
  const db = {sha: 'content-hash', syncWith, resolve}
  const cms = createCMS(
    Config.create({
      baseUrl: 'https://example.com',
      handlerUrl: '/api/cms',
      schema: {},
      workspaces: {}
    })
  )
  cms.bundledDb = PLazy.from(async () => db as unknown as LocalStore)
  return {cms, resolve, syncWith}
}

/** The name and value of a Set-Cookie header. */
function cookieOf(header: string) {
  const [pair] = header.split(';')
  const index = pair.indexOf('=')
  return {name: pair.slice(0, index), value: pair.slice(index + 1)}
}

function requestWithCookie(value: string) {
  return new Request('https://example.com/page', {
    headers: {cookie: `other=1; ${DRAFT_COOKIE_NAME}=${value}`}
  })
}

test('queries outside a request are not drafts', async () => {
  const {cms, resolve} = testCMS()

  await cms.resolve({disableSync: true})

  expect(resolve.mock.calls[0][0].status).toBeUndefined()
})

test('queries in a request with a draft cookie prefer drafts', async () => {
  const {cms, resolve} = testCMS()
  const {value} = cookieOf(await draftCookie(apiKey, true))
  const request = requestWithCookie(value)

  await withRequest(request, () => cms.resolve({disableSync: true}))

  expect(resolve.mock.calls[0][0].status).toBe('preferDraft')
})

test('an invalid draft cookie is ignored', async () => {
  const {cms, resolve} = testCMS()
  const request = requestWithCookie('invalid')

  await withRequest(request, () => cms.resolve({disableSync: true}))

  expect(resolve.mock.calls[0][0].status).toBeUndefined()
})

test('a preview token sets the draft cookie and redirects', async () => {
  const {cms} = testCMS()
  const handle = createHandler(cms)
  const now = Math.floor(Date.now() / 1000)
  const token = await sign(
    {purpose: 'preview', iat: now, exp: now + 60},
    apiKey
  )
  const url = new URL('https://example.com/api/cms')
  url.searchParams.set('preview', token)
  url.searchParams.set('returnTo', '/x')

  const response = await handle(new Request(url))

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('https://example.com/x')
  const cookie = cookieOf(response.headers.get('set-cookie') ?? '')
  expect(cookie.name).toBe(DRAFT_COOKIE_NAME)
  expect(await hasDraftCookie([cookie], apiKey)).toBe(true)
})

test('without a shared sha the throttle keeps content fresh', async () => {
  const {cms, syncWith} = testCMS()
  const getTreeIfDifferent = spyOn(Client.prototype, 'getTreeIfDifferent')
  try {
    for (let i = 0; i < 3; i++) await cms.resolve({syncInterval: 60})

    expect(syncWith).toHaveBeenCalledTimes(1)
    expect(getTreeIfDifferent).not.toHaveBeenCalled()
  } finally {
    getTreeIfDifferent.mockRestore()
  }
})
