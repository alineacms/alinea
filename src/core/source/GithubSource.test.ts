import {suite} from '@alinea/suite'
import {HttpError} from '../HttpError.js'
import {diff} from '../source/Source.js'
import {FSSource} from './FSSource.js'
import {hashBlob} from './GitUtils.js'
import {GithubSource, normalizeGithubSourceOptions} from './GithubSource.js'
import {ReadonlyTree} from './Tree.js'

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
    // Backends create a source per request, so the etag must outlive it
    const source = () =>
      new GithubSource({
        owner: 'owner',
        repo: 'etag-repo',
        branch: 'main',
        authToken: 'token',
        rootDir: '',
        contentDir: 'content'
      })

    test.is(await source().shaAt('main'), 'first-sha')
    test.is(await source().shaAt('main'), 'first-sha')
    test.is(await source().shaAt('main'), 'second-sha')
    test.is(await source().shaAt('main'), 'second-sha')
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

test('reports why GitHub refused a request', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async (): Promise<Response> =>
      Response.json(
        {message: 'Resource not accessible by personal access token'},
        {status: 403, statusText: 'Forbidden'}
      ),
    {preconnect: originalFetch.preconnect}
  )
  try {
    const source = new GithubSource({
      owner: 'owner',
      repo: 'forbidden-repo',
      branch: 'main',
      authToken: 'token',
      rootDir: '',
      contentDir: 'content'
    })
    const error = await source.shaAt('main').catch(error => error)
    test.ok(error instanceof HttpError)
    test.is(error.code, 403)
    test.is(
      error.message,
      'Failed to get parent: 403 Resource not accessible by personal access token'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetches untruncated trees in one recursive request', async () => {
  const flat = {
    sha: 'flat-sha',
    tree: [
      {path: 'a.json', type: 'blob', mode: '100644', sha: 'a-sha'},
      {path: 'dir', type: 'tree', mode: '040000', sha: 'dir-sha'},
      {path: 'dir/b.json', type: 'blob', mode: '100644', sha: 'b-sha'}
    ]
  }
  const originalFetch = globalThis.fetch
  const treeRequests = Array<string>()
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      if (url.includes('/contents/'))
        return Response.json([{path: 'content', sha: 'flat-sha'}])
      treeRequests.push(url.split('/git/trees/')[1])
      return Response.json({...flat, truncated: false})
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const source = new GithubSource({
      owner: 'owner',
      repo: 'untruncated-repo',
      branch: 'main',
      authToken: 'token',
      rootDir: '',
      contentDir: 'content'
    })
    const tree = await source.getTree()
    test.equal(tree.flat(), ReadonlyTree.fromFlat(flat).flat())
    test.equal(treeRequests, ['flat-sha?recursive=true'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('splits trees GitHub truncates by directory', async () => {
  const full = {
    sha: 'root-sha',
    tree: [
      {path: 'a.json', type: 'blob', mode: '100644', sha: 'a-sha'},
      {path: 'dir', type: 'tree', mode: '040000', sha: 'dir-sha'},
      {path: 'dir/b.json', type: 'blob', mode: '100644', sha: 'b-sha'}
    ]
  }
  const trees: Record<string, object> = {
    'root-sha?recursive=true': {sha: 'root-sha', tree: [], truncated: true},
    'root-sha': {
      sha: 'root-sha',
      tree: full.tree.slice(0, 2),
      truncated: false
    },
    'dir-sha?recursive=true': {
      sha: 'dir-sha',
      tree: [{path: 'b.json', type: 'blob', mode: '100644', sha: 'b-sha'}],
      truncated: false
    },
    'next-sha': {
      sha: 'next-sha',
      tree: [
        {path: 'a.json', type: 'blob', mode: '100644', sha: 'a2-sha'},
        full.tree[1]
      ],
      truncated: false
    }
  }
  const originalFetch = globalThis.fetch
  const treeRequests = Array<string>()
  let rootSha = 'root-sha'
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      if (url.includes('/contents/'))
        return Response.json([{path: 'content', sha: rootSha}])
      const key = url.split('/git/trees/')[1]
      treeRequests.push(key)
      return Response.json(trees[key])
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const source = new GithubSource({
      owner: 'owner',
      repo: 'truncated-repo',
      branch: 'main',
      authToken: 'token',
      rootDir: '',
      contentDir: 'content'
    })
    const tree = await source.getTree()
    test.equal(tree.flat(), ReadonlyTree.fromFlat(full).flat())
    test.equal(treeRequests, [
      'root-sha?recursive=true',
      'root-sha',
      'dir-sha?recursive=true'
    ])

    // The root is remembered as truncated, its subdirectory is not
    treeRequests.length = 0
    rootSha = 'next-sha'
    const next = await source.getTree()
    test.equal(
      next.flat(),
      ReadonlyTree.fromFlat({
        sha: 'next-sha',
        tree: [
          {path: 'a.json', type: 'blob', mode: '100644', sha: 'a2-sha'},
          ...full.tree.slice(1)
        ]
      }).flat()
    )
    test.equal(treeRequests, ['next-sha', 'dir-sha?recursive=true'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetches blobs a hundred at a time through GraphQL', async () => {
  const texts = await textBlobs(150)
  const encoder = new TextEncoder()
  const binaryBytes = new Uint8Array([0, 1, 2, 3])
  const binary = await hashBlob(binaryBytes)
  // Latin-1 text, which GraphQL can only give as decoded UTF-8
  const latinBytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9])
  const latin = await hashBlob(latinBytes)
  const shas = [...texts.keys(), binary, latin]
  const originalFetch = globalThis.fetch
  const queries = Array<number>()
  const restBlobs = Array<string>()
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      if (url.endsWith('/graphql')) {
        const requested = requestedBlobs(init)
        queries.push(requested.length)
        const repository = Object.fromEntries(
          requested.map(([key, sha]) => [
            key,
            sha === binary
              ? {text: null, isBinary: true, isTruncated: false}
              : sha === latin
                ? {text: 'caf\uFFFD', isBinary: false, isTruncated: false}
                : {text: texts.get(sha), isBinary: false, isTruncated: false}
          ])
        )
        return Response.json({data: {repository}})
      }
      const sha = url.split('/git/blobs/')[1]
      restBlobs.push(sha)
      const bytes = sha === binary ? binaryBytes : latinBytes
      return Response.json({
        encoding: 'base64',
        content: btoa(String.fromCharCode(...bytes)),
        size: bytes.length
      })
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const blobs = new Map<string, Uint8Array>()
    for await (const [sha, blob] of githubSource().getBlobs(shas))
      blobs.set(sha, blob)
    test.equal(queries, [100, 52])
    test.equal(restBlobs, [binary, latin])
    test.equal([...blobs.keys()], shas)
    for (const [sha, text] of texts)
      test.equal(blobs.get(sha), encoder.encode(text))
    test.equal(blobs.get(binary), binaryBytes)
    test.equal(blobs.get(latin), latinBytes)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('asks again in halves for blobs GitHub cannot answer at once', async () => {
  const texts = await textBlobs(100)
  const shas = [...texts.keys()]
  const originalFetch = globalThis.fetch
  const queries = Array<number>()
  globalThis.fetch = Object.assign(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const requested = requestedBlobs(init)
      queries.push(requested.length)
      // Too many large files to answer in time
      if (requested.length > 30) {
        return requested.length > 60
          ? new Response('Bad gateway', {status: 502})
          : Response.json({
              data: null,
              errors: [{message: 'Something went wrong. This may be a timeout'}]
            })
      }
      const repository = Object.fromEntries(
        requested.map(([key, sha]) => [
          key,
          {text: texts.get(sha), isBinary: false, isTruncated: false}
        ])
      )
      return Response.json({data: {repository}})
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const fetched = Array<string>()
    for await (const [sha] of githubSource().getBlobs(shas)) fetched.push(sha)
    test.equal(fetched, shas)
    test.equal(queries, [100, 50, 25, 25, 50, 25, 25])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('gives up on blobs after a few queries while GitHub fails', async () => {
  const shas = [...(await textBlobs(300)).keys()]
  const originalFetch = globalThis.fetch
  const queries = Array<number>()
  let restCalls = 0
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).endsWith('/graphql')) restCalls += 1
      else queries.push(requestedBlobs(init).length)
      return new Response('Bad gateway', {status: 502})
    },
    {preconnect: originalFetch.preconnect}
  )
  const unhandled = Array<unknown>()
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  process.on('unhandledRejection', onUnhandled)
  try {
    let failure: unknown
    try {
      for await (const _ of githubSource().getBlobs(shas)) {
      }
    } catch (error) {
      failure = error
    }
    test.ok(failure instanceof HttpError)
    // The batches after the failed one settle on their own
    await new Promise(resolve => setTimeout(resolve, 50))
    test.equal(unhandled, [])
    test.is(restCalls, 0)
    // Each of the three batches tries 100, 50 and 25 blobs
    test.equal(
      queries.toSorted((a, b) => a - b),
      [25, 25, 25, 50, 50, 50, 100, 100, 100]
    )
  } finally {
    process.off('unhandledRejection', onUnhandled)
    globalThis.fetch = originalFetch
  }
})

test('reports GraphQL errors such as a rate limit right away', async () => {
  const originalFetch = globalThis.fetch
  let queries = 0
  globalThis.fetch = Object.assign(
    async (): Promise<Response> => {
      queries += 1
      return Response.json({
        data: null,
        errors: [{type: 'RATE_LIMITED', message: 'API rate limit exceeded'}]
      })
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const source = new GithubSource({
      owner: 'owner',
      repo: 'limited-repo',
      branch: 'main',
      authToken: 'token',
      rootDir: '',
      contentDir: 'content'
    })
    const shas = ['a'.repeat(40), 'b'.repeat(40)]
    let failure: unknown
    try {
      for await (const _ of source.getBlobs(shas)) {
      }
    } catch (error) {
      failure = error
    }
    test.ok(failure instanceof Error)
    test.ok(String(failure).includes('API rate limit exceeded'))
    test.is(queries, 1)
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

function githubSource(): GithubSource {
  return new GithubSource({
    owner: 'owner',
    repo: 'blob-repo',
    branch: 'main',
    authToken: 'token',
    rootDir: '',
    contentDir: 'content'
  })
}

/** Texts by the sha of their blob. */
async function textBlobs(count: number): Promise<Map<string, string>> {
  const encoder = new TextEncoder()
  const texts = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    const text = `{"title": "Entry ${i}"}`
    texts.set(await hashBlob(encoder.encode(text)), text)
  }
  return texts
}

/** The aliases and shas a GraphQL blob query asks for. */
function requestedBlobs(init?: RequestInit): Array<[string, string]> {
  const {variables} = JSON.parse(String(init?.body))
  return Object.entries(variables as Record<string, string>).filter(([key]) =>
    /^b\d+$/.test(key)
  )
}
