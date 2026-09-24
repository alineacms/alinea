import {nextMocks} from '#test/NextMocks.js'
import {draftCookie} from '#/adapter/core/DraftCookie.js'
import {createCMS} from '#/adapter/server/node.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Config} from '#/index.js'
import {beforeEach, expect, mock, test} from 'bun:test'
import PLazy from 'p-lazy'
import {createHandle} from './handle.js'

const apiKey = 'sveltekit-secret'

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

// SvelteKit passes more than the request, and resolve takes options
interface TestEvent {
  request: Request
  locals: Record<string, unknown>
}

test('alinea routes are answered without resolving the page', async () => {
  const {cms} = testCMS()
  const handle = createHandle(cms)
  const resolve = mock(async (_event: TestEvent) => new Response('page'))
  const event = {request: new Request('https://example.com/admin'), locals: {}}

  const response = await handle({event, resolve})

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/admin.html')
  expect(resolve).not.toHaveBeenCalled()
})

test('load functions run within the request and see its drafts', async () => {
  const {cms, resolve} = testCMS()
  const handle = createHandle(cms)
  const [cookie] = (await draftCookie(apiKey, true)).split(';')
  const request = new Request('https://example.com/page', {headers: {cookie}})
  const event: TestEvent = {request, locals: {}}
  let resolved: TestEvent | undefined

  const response = await handle({
    event,
    async resolve(current, _options?: {preload?: () => boolean}) {
      resolved = current
      // A server load function querying the CMS
      await cms.resolve({disableSync: true})
      return new Response('page')
    }
  })

  expect(await response.text()).toBe('page')
  expect(resolved).toBe(event)
  expect(resolve.mock.calls[0][0].status).toBe('preferDraft')
})
