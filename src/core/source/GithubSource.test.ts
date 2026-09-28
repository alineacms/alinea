import {suite} from '@alinea/suite'
import {HttpError} from '../HttpError.js'
import {diff} from '../source/Source.js'
import {FSSource} from './FSSource.js'
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
