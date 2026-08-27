import {suite} from '@alinea/suite'
import {diff} from '../source/Source.js'
import {FSSource} from './FSSource.js'
import {GithubSource, normalizeGithubSourceOptions} from './GithubSource.js'

const test = suite(import.meta)

test('normalizes repository directories', () => {
  const options = normalizeGithubSourceOptions({
    owner: 'owner',
    repo: 'repo',
    branch: 'main',
    authToken: 'token',
    rootDir: '/',
    contentDir: '\\content\\pages\\'
  })

  test.is(options.rootDir, '')
  test.is(options.contentDir, 'content/pages')
})

test('uses etags for conditional sha requests', async () => {
  const originalFetch = globalThis.fetch
  const ifNoneMatch = Array<string | null>()
  let request = 0
  const mockFetch: typeof fetch = Object.assign(
    async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      request += 1
      const headers = new Headers(init?.headers)
      test.is(headers.get('Authorization'), 'Bearer token')
      ifNoneMatch.push(headers.get('If-None-Match'))
      if (request === 1) {
        return Response.json([{path: 'content', sha: 'first-sha'}], {
          headers: {etag: '"first-etag"'}
        })
      }
      if (request === 2) return new Response(null, {status: 304})
      if (request === 3) {
        return Response.json([{path: 'content', sha: 'second-sha'}], {
          headers: {etag: '"second-etag"'}
        })
      }
      return new Response(null, {status: 304})
    },
    {preconnect: originalFetch.preconnect}
  )
  globalThis.fetch = mockFetch

  try {
    const source = new GithubSource({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      authToken: 'token',
      rootDir: '',
      contentDir: 'content'
    })

    test.is(await source.shaAt('main'), 'first-sha')
    test.is(await source.shaAt('main'), 'first-sha')
    test.is(await source.shaAt('main'), 'second-sha')
    test.is(await source.shaAt('main'), 'second-sha')
    test.equal(ifNoneMatch, [
      null,
      '"first-etag"',
      '"first-etag"',
      '"second-etag"'
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('sync', async () => {
  if (!process.env.GITHUB_AUTH_TOKEN) return
  const dir = 'test/fixtures/demo'
  const fsSource = new FSSource(dir)
  const ghSource = new GithubSource({
    owner: 'alineacms',
    repo: 'alinea',
    branch: 'main',
    authToken: process.env.GITHUB_AUTH_TOKEN!,
    rootDir: 'apps/web',
    contentDir: 'content/demo'
  })
  const batch = await diff(fsSource, ghSource)
  test.is(batch.changes.length, 0)
})
