import {suite} from '@alinea/suite'
import type {CommitRequest} from 'alinea/core/db/CommitRequest'
import {btoa} from 'alinea/core/util/Encoding'
import {ShaMismatchError} from 'alinea/core/source/ShaMismatchError'
import {GithubApi} from './GithubApi.js'

const test = suite(import.meta)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'}
  })
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

async function requestBody(init?: RequestInit) {
  if (!init?.body) return undefined
  if (typeof init.body === 'string') return JSON.parse(init.body)
  return JSON.parse(await new Response(init.body).text())
}

function createApi(
  options: Partial<ConstructorParameters<typeof GithubApi>[0]> = {}
) {
  return new GithubApi({
    owner: 'acme',
    repo: 'site',
    branch: 'main',
    authToken: 'token',
    rootDir: 'repo',
    contentDir: 'content',
    ...options
  })
}

function baseRequest(request: Partial<CommitRequest> = {}): CommitRequest {
  return {
    description: 'Update content',
    fromSha: 'tree-old',
    intoSha: 'unused',
    checks: [],
    changes: [],
    ...request
  }
}

test('write commits through REST git endpoints', async () => {
  const api = createApi()
  const request = baseRequest({
    changes: [
      {
        op: 'addContent',
        path: 'pages/home.json',
        sha: 'sha-add',
        contents: '{"title":"Hello"}'
      },
      {
        op: 'uploadFile',
        location: 'uploads/file.bin',
        url: 'https://upload.local/file.bin'
      },
      {op: 'deleteContent', path: 'pages/old.json', sha: 'sha-del'},
      {op: 'removeFile', location: 'uploads/remove.bin'}
    ]
  })
  const originalFetch = globalThis.fetch
  const blobBodies = Array<any>()
  let treeBody: any
  let commitBody: any
  let refBody: any
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    if (url === 'https://upload.local/file.bin') return new Response('uploaded')
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    const body = await requestBody(init)

    if (
      method === 'GET' &&
      pathname === '/repos/acme/site/git/ref/heads/main'
    ) {
      return json({object: {sha: 'head-1'}})
    }
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo') {
      const ref = parsed.searchParams.get('ref')
      if (ref === 'head-1') return json([{path: 'repo/content', sha: 'tree-old'}])
      if (ref === 'commit-new')
        return json([{path: 'repo/content', sha: 'tree-new-sha'}])
    }
    if (method === 'GET' && pathname === '/repos/acme/site/git/commits/head-1') {
      return json({tree: {sha: 'base-tree'}})
    }
    if (method === 'POST' && pathname === '/repos/acme/site/git/blobs') {
      blobBodies.push(body)
      const sha =
        body.content === btoa('{"title":"Hello"}')
          ? 'blob-content'
          : 'blob-upload'
      return json({sha})
    }
    if (method === 'POST' && pathname === '/repos/acme/site/git/trees') {
      treeBody = body
      return json({sha: 'tree-new'})
    }
    if (method === 'POST' && pathname === '/repos/acme/site/git/commits') {
      commitBody = body
      return json({sha: 'commit-new'})
    }
    if (method === 'PATCH' && pathname === '/repos/acme/site/git/refs/heads/main') {
      refBody = body
      return json({updated: true})
    }
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch

  try {
    const result = await api.write(request)
    test.is(result.sha, 'tree-new-sha')
    test.equal(blobBodies, [
      {content: btoa('{"title":"Hello"}'), encoding: 'base64'},
      {content: btoa('uploaded'), encoding: 'base64'}
    ])
    test.equal(treeBody, {
      base_tree: 'base-tree',
      tree: [
        {
          path: 'repo/content/pages/home.json',
          mode: '100644',
          type: 'blob',
          sha: 'blob-content'
        },
        {
          path: 'repo/uploads/file.bin',
          mode: '100644',
          type: 'blob',
          sha: 'blob-upload'
        },
        {
          path: 'repo/content/pages/old.json',
          mode: '100644',
          type: 'blob',
          sha: null
        },
        {
          path: 'repo/uploads/remove.bin',
          mode: '100644',
          type: 'blob',
          sha: null
        }
      ]
    })
    test.equal(commitBody, {
      message: 'Update content',
      tree: 'tree-new',
      parents: ['head-1']
    })
    test.equal(refBody, {sha: 'commit-new', force: false})
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write uploads blobs sequentially by default', async () => {
  const api = createApi()
  const request = baseRequest({
    changes: [
      {
        op: 'uploadFile',
        location: 'uploads/one.bin',
        url: 'https://upload.local/one.bin'
      },
      {
        op: 'uploadFile',
        location: 'uploads/two.bin',
        url: 'https://upload.local/two.bin'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  let inFlight = 0
  let maxInFlight = 0
  let blobCalls = 0
  let releaseFirst: () => void
  const firstGate = new Promise<void>(resolve => {
    releaseFirst = resolve
  })
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    if (url === 'https://upload.local/one.bin' || url === 'https://upload.local/two.bin')
      return new Response('uploaded')
    if (method === 'GET' && pathname === '/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: 'head-1'}})
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo') {
      const ref = parsed.searchParams.get('ref')
      if (ref === 'head-1') return json([{path: 'repo/content', sha: 'tree-old'}])
      if (ref === 'commit-new')
        return json([{path: 'repo/content', sha: 'tree-new-sha'}])
    }
    if (method === 'GET' && pathname === '/repos/acme/site/git/commits/head-1')
      return json({tree: {sha: 'base-tree'}})
    if (method === 'POST' && pathname === '/repos/acme/site/git/blobs') {
      const call = ++blobCalls
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      if (call === 1) {
        setTimeout(() => releaseFirst(), 25)
        await firstGate
      }
      inFlight--
      return json({sha: call === 1 ? 'blob-one' : 'blob-two'})
    }
    if (method === 'POST' && pathname === '/repos/acme/site/git/trees')
      return json({sha: 'tree-new'})
    if (method === 'POST' && pathname === '/repos/acme/site/git/commits')
      return json({sha: 'commit-new'})
    if (method === 'PATCH' && pathname === '/repos/acme/site/git/refs/heads/main')
      return json({updated: true})
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    const result = await api.write(request)
    test.is(result.sha, 'tree-new-sha')
    test.is(blobCalls, 2)
    test.is(maxInFlight, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write uses chunked base64 stream and preserves encoded content', async () => {
  const api = createApi({blobChunkBytes: 5})
  const request = baseRequest({
    changes: [
      {
        op: 'uploadFile',
        location: 'uploads/chunk.bin',
        url: 'https://upload.local/chunk.bin'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  let blobBody: any
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    if (url === 'https://upload.local/chunk.bin') return new Response('hello world')
    if (method === 'GET' && pathname === '/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: 'head-1'}})
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo') {
      const ref = parsed.searchParams.get('ref')
      if (ref === 'head-1') return json([{path: 'repo/content', sha: 'tree-old'}])
      if (ref === 'commit-new')
        return json([{path: 'repo/content', sha: 'tree-new-sha'}])
    }
    if (method === 'GET' && pathname === '/repos/acme/site/git/commits/head-1')
      return json({tree: {sha: 'base-tree'}})
    if (method === 'POST' && pathname === '/repos/acme/site/git/blobs') {
      blobBody = await requestBody(init)
      return json({sha: 'blob-upload'})
    }
    if (method === 'POST' && pathname === '/repos/acme/site/git/trees')
      return json({sha: 'tree-new'})
    if (method === 'POST' && pathname === '/repos/acme/site/git/commits')
      return json({sha: 'commit-new'})
    if (method === 'PATCH' && pathname === '/repos/acme/site/git/refs/heads/main')
      return json({updated: true})
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    const result = await api.write(request)
    test.is(result.sha, 'tree-new-sha')
    test.equal(blobBody, {content: btoa('hello world'), encoding: 'base64'})
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write rejects upload bigger than maxBlobBytes', async () => {
  const api = createApi({maxBlobBytes: 5})
  const request = baseRequest({
    changes: [
      {
        op: 'uploadFile',
        location: 'uploads/too-big.bin',
        url: 'https://upload.local/too-big.bin'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    if (url === 'https://upload.local/too-big.bin') {
      return new Response('1234567890', {
        headers: {'content-length': '10'}
      })
    }
    if (method === 'GET' && pathname === '/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: 'head-1'}})
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo')
      return json([{path: 'repo/content', sha: 'tree-old'}])
    if (method === 'GET' && pathname === '/repos/acme/site/git/commits/head-1')
      return json({tree: {sha: 'base-tree'}})
    if (method === 'POST' && pathname === '/repos/acme/site/git/blobs') {
      await requestBody(init)
      return json({sha: 'blob-upload'})
    }
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    await test.throws(() => api.write(request), 'Upload exceeds max blob size')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write throws ShaMismatchError when ref update races', async () => {
  const api = createApi()
  const request = baseRequest({
    changes: [
      {
        op: 'addContent',
        path: 'pages/home.json',
        sha: 'sha-add',
        contents: '{"title":"Hello"}'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  let refsRead = 0
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    if (
      method === 'GET' &&
      pathname === '/repos/acme/site/git/ref/heads/main'
    ) {
      refsRead++
      const sha = refsRead === 1 ? 'head-1' : 'head-2'
      return json({object: {sha}})
    }
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo') {
      return json([{path: 'repo/content', sha: 'tree-old'}])
    }
    if (method === 'GET' && pathname === '/repos/acme/site/git/commits/head-1') {
      return json({tree: {sha: 'base-tree'}})
    }
    if (method === 'POST' && pathname === '/repos/acme/site/git/blobs') {
      return json({sha: 'blob-content'})
    }
    if (method === 'POST' && pathname === '/repos/acme/site/git/trees') {
      return json({sha: 'tree-new'})
    }
    if (method === 'POST' && pathname === '/repos/acme/site/git/commits') {
      return json({sha: 'commit-new'})
    }
    if (method === 'PATCH' && pathname === '/repos/acme/site/git/refs/heads/main') {
      return new Response('Reference update failed', {status: 422})
    }
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch

  try {
    let caught: unknown
    try {
      await api.write(request)
    } catch (error) {
      caught = error
    }
    test.ok(caught instanceof ShaMismatchError)
    test.is((caught as ShaMismatchError).actual, 'head-2')
    test.is((caught as ShaMismatchError).expected, 'head-1')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write appends co-author to commit message', async () => {
  const api = createApi({author: {name: 'Ben', email: 'ben@example.com'}})
  const request = baseRequest({
    changes: [
      {
        op: 'addContent',
        path: 'pages/home.json',
        sha: 'sha-add',
        contents: '{"title":"Hello"}'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  let commitMessage = ''
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    const body = await requestBody(init)
    if (method === 'GET' && pathname === '/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: 'head-1'}})
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo') {
      const ref = parsed.searchParams.get('ref')
      if (ref === 'head-1') return json([{path: 'repo/content', sha: 'tree-old'}])
      if (ref === 'commit-new')
        return json([{path: 'repo/content', sha: 'tree-new-sha'}])
    }
    if (method === 'GET' && pathname === '/repos/acme/site/git/commits/head-1')
      return json({tree: {sha: 'base-tree'}})
    if (method === 'POST' && pathname === '/repos/acme/site/git/blobs')
      return json({sha: 'blob-content'})
    if (method === 'POST' && pathname === '/repos/acme/site/git/trees')
      return json({sha: 'tree-new'})
    if (method === 'POST' && pathname === '/repos/acme/site/git/commits') {
      commitMessage = body.message
      return json({sha: 'commit-new'})
    }
    if (method === 'PATCH' && pathname === '/repos/acme/site/git/refs/heads/main')
      return json({updated: true})
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    const result = await api.write(request)
    test.is(result.sha, 'tree-new-sha')
    test.is(
      commitMessage,
      'Update content\n\nCo-authored-by: Ben <ben@example.com>'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write no-op returns existing sha and skips git write endpoints', async () => {
  const api = createApi()
  const originalFetch = globalThis.fetch
  let writeCalls = 0
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    if (method === 'GET' && pathname === '/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: 'head-1'}})
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo')
      return json([{path: 'repo/content', sha: 'tree-old'}])
    if (
      pathname === '/repos/acme/site/git/blobs' ||
      pathname === '/repos/acme/site/git/trees' ||
      pathname === '/repos/acme/site/git/commits' ||
      pathname === '/repos/acme/site/git/refs/heads/main'
    ) {
      writeCalls++
    }
    if (method === 'GET' && pathname === '/repos/acme/site/git/commits/head-1')
      return json({tree: {sha: 'base-tree'}})
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    const result = await api.write(baseRequest())
    test.is(result.sha, 'tree-old')
    test.is(writeCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write throws ShaMismatchError on preflight tree mismatch', async () => {
  const api = createApi()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    if (method === 'GET' && pathname === '/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: 'head-1'}})
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo')
      return json([{path: 'repo/content', sha: 'tree-different'}])
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    let caught: unknown
    try {
      await api.write(baseRequest({fromSha: 'tree-old'}))
    } catch (error) {
      caught = error
    }
    test.ok(caught instanceof ShaMismatchError)
    test.is((caught as ShaMismatchError).actual, 'tree-different')
    test.is((caught as ShaMismatchError).expected, 'tree-old')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('write rethrows original error when ref update fails without head change', async () => {
  const api = createApi()
  const request = baseRequest({
    changes: [
      {
        op: 'addContent',
        path: 'pages/home.json',
        sha: 'sha-add',
        contents: '{"title":"Hello"}'
      }
    ]
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const parsed = new URL(url)
    const method = init?.method ?? 'GET'
    const pathname = parsed.pathname
    if (method === 'GET' && pathname === '/repos/acme/site/git/ref/heads/main')
      return json({object: {sha: 'head-1'}})
    if (method === 'GET' && pathname === '/repos/acme/site/contents/repo')
      return json([{path: 'repo/content', sha: 'tree-old'}])
    if (method === 'GET' && pathname === '/repos/acme/site/git/commits/head-1')
      return json({tree: {sha: 'base-tree'}})
    if (method === 'POST' && pathname === '/repos/acme/site/git/blobs')
      return json({sha: 'blob-content'})
    if (method === 'POST' && pathname === '/repos/acme/site/git/trees')
      return json({sha: 'tree-new'})
    if (method === 'POST' && pathname === '/repos/acme/site/git/commits')
      return json({sha: 'commit-new'})
    if (method === 'PATCH' && pathname === '/repos/acme/site/git/refs/heads/main')
      return new Response('Ref update failed', {status: 409})
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    await test.throws(() => api.write(request), 'Ref update failed')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('revisionData parses JSON and returns undefined for invalid data', async () => {
  const api = createApi()
  const originalFetch = globalThis.fetch
  let graphqlRead = 0
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const method = init?.method ?? 'GET'
    if (url === 'https://api.github.com/graphql' && method === 'POST') {
      graphqlRead++
      if (graphqlRead === 1)
        return json({data: {repository: {object: {text: '{"id":"entry-1"}'}}}})
      return json({data: {repository: {object: {text: '{invalid json'}}}})
    }
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    const valid = await api.revisionData('pages/home.json', 'commit-1')
    const invalid = await api.revisionData('pages/home.json', 'commit-2')
    test.equal(valid, {id: 'entry-1'})
    test.is(invalid, undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('revisions combines history, resolves renames, and sorts newest first', async () => {
  const api = createApi()
  const originalFetch = globalThis.fetch
  let historyCalls = 0
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input)
    const method = init?.method ?? 'GET'
    if (url === 'https://api.github.com/graphql' && method === 'POST') {
      historyCalls++
      const body = await requestBody(init)
      if (!String(body?.query).includes('GetFileHistory'))
        return new Response('Unexpected graphql query', {status: 500})
      if (historyCalls === 1) {
        return json({
          data: {
            repository: {
              ref: {
                target: {
                  file0: {
                    nodes: [
                      {
                        oid: 'c-new',
                        committedDate: '2024-01-03T00:00:00.000Z',
                        message: 'Latest',
                        author: {name: 'Author', email: 'author@example.com'}
                      },
                      {
                        oid: 'c-old',
                        committedDate: '2024-01-01T00:00:00.000Z',
                        message:
                          'Old\n\nCo-authored-by: Co <co@example.com>',
                        author: {name: 'Ignored', email: 'ignored@example.com'}
                      }
                    ]
                  },
                  file1: {nodes: []},
                  file2: {nodes: []}
                }
              }
            }
          }
        })
      }
      return json({
        data: {
          repository: {
            ref: {
              target: {
                file0: {
                  nodes: [
                    {
                      oid: 'c-rename',
                      committedDate: '2024-01-02T00:00:00.000Z',
                      message: 'Renamed file',
                      author: {name: 'Renamer', email: 'renamer@example.com'}
                    }
                  ]
                },
                file1: {nodes: []},
                file2: {nodes: []}
              }
            }
          }
        }
      })
    }
    if (
      method === 'GET' &&
      url === 'https://api.github.com/repos/acme/site/commits/c-old'
    ) {
      return json({
        files: [
          {
            filename: 'repo/pages/home.json',
            previous_filename: 'repo/pages/welcome.json'
          }
        ]
      })
    }
    if (
      method === 'GET' &&
      url === 'https://api.github.com/repos/acme/site/commits/c-rename'
    ) {
      return json({files: [{filename: 'repo/pages/welcome.json'}]})
    }
    return new Response(`Unexpected ${method} ${url}`, {status: 500})
  }) as typeof fetch
  try {
    const revisions = await api.revisions('pages/home.json')
    test.equal(
      revisions.map(revision => revision.ref),
      ['c-new', 'c-rename', 'c-old']
    )
    test.is(revisions[0].file, 'pages/home.json')
    test.is(revisions[1].file, 'pages/welcome.json')
    test.equal(revisions[2].user, {name: 'Co', email: 'co@example.com'})
  } finally {
    globalThis.fetch = originalFetch
  }
})
