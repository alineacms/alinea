import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {HttpError} from '#/core/HttpError.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {isRecord} from '#/core/util/Objects.js'
import {suite} from '@alinea/suite'
import {GithubApi} from './GithubApi.js'

const test = suite(import.meta)

test('uses commit request user for co-authored-by trailer', async () => {
  const originalFetch = globalThis.fetch
  const fromSha = 'from-sha'
  const intoSha = 'into-sha'
  let commitMessage: string | undefined
  let graphQlCalls = 0

  const mockFetch: typeof fetch = Object.assign(
    async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [input, init] = args
      const url = String(input)
      if (url === 'https://api.github.com/graphql') {
        graphQlCalls += 1
        if (graphQlCalls === 1) {
          return Response.json({
            data: {
              repository: {
                ref: {
                  target: {
                    oid: 'head-oid',
                    file: {oid: fromSha}
                  }
                }
              }
            }
          })
        }

        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        commitMessage = readCommitMessage(body)
        return Response.json({
          data: {
            createCommitOnBranch: {
              commit: {
                oid: 'commit-oid',
                file: {oid: intoSha}
              }
            }
          }
        })
      }

      throw new Error(`A save made a REST request: ${url}`)
    },
    {preconnect: originalFetch.preconnect}
  )

  globalThis.fetch = mockFetch

  try {
    const api = new GithubApi({
      authToken: 'token',
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      rootDir: '',
      contentDir: 'content'
    })
    const request: CommitRequest = {
      description: 'Alinea content update',
      user: {
        sub: 'ada@example.com',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        roles: ['admin']
      },
      fromSha,
      intoSha,
      changes: []
    }

    test.equal(await api.write(request), {sha: intoSha})
    test.is(
      commitMessage,
      'Alinea content update\n\nCo-authored-by: Ada Lovelace <ada@example.com>'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uses repository-relative media paths in commits', async () => {
  const originalFetch = globalThis.fetch
  const fromSha = 'from-sha'
  const intoSha = 'into-sha'
  let fileChanges: unknown
  let graphQlCalls = 0

  const mockFetch: typeof fetch = Object.assign(
    async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [input, init] = args
      const url = String(input)
      if (url === 'https://uploads.example/image.jpg')
        return new Response('image')
      if (url === 'https://api.github.com/graphql') {
        graphQlCalls += 1
        if (graphQlCalls === 1) {
          return Response.json({
            data: {
              repository: {
                ref: {target: {oid: 'head-oid', file: {oid: fromSha}}}
              }
            }
          })
        }

        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        fileChanges = readFileChanges(body)
        return Response.json({
          data: {
            createCommitOnBranch: {
              commit: {oid: 'commit-oid', file: {oid: intoSha}}
            }
          }
        })
      }

      throw new Error(`A save made a REST request: ${url}`)
    },
    {preconnect: originalFetch.preconnect}
  )

  globalThis.fetch = mockFetch

  try {
    const api = new GithubApi({
      authToken: 'token',
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      rootDir: '/',
      contentDir: '/content'
    })
    const request: CommitRequest = {
      description: 'Update media',
      fromSha,
      intoSha,
      changes: [
        {
          op: 'uploadFile',
          url: 'https://uploads.example/image.jpg',
          location: '/public/media/image.jpg'
        },
        {op: 'removeFile', location: '/public/media/old.jpg'}
      ]
    }

    test.equal(await api.write(request), {sha: intoSha})
    test.equal(fileChanges, {
      additions: [{path: 'public/media/image.jpg', contents: 'aW1hZ2U='}],
      deletions: [{path: 'public/media/old.jpg'}]
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

function readCommitMessage(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined
  const variables = body.variables
  if (!isRecord(variables)) return undefined
  const input = variables.input
  if (!isRecord(input)) return undefined
  const message = input.message
  if (!isRecord(message)) return undefined
  return typeof message.headline === 'string' ? message.headline : undefined
}

function readFileChanges(body: unknown): unknown {
  if (!isRecord(body)) return
  const variables = body.variables
  if (!isRecord(variables)) return
  const input = variables.input
  return isRecord(input) ? input.fileChanges : undefined
}

test('commits the first entry of a content directory', async () => {
  const originalFetch = globalThis.fetch
  let graphQlCalls = 0
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      if (url !== 'https://api.github.com/graphql')
        throw new Error(`A save made a REST request: ${url}`)
      graphQlCalls += 1
      if (graphQlCalls === 1) {
        // GitHub reports the missing directory next to a null file
        return Response.json({
          data: {repository: {ref: {target: {oid: 'head-oid', file: null}}}},
          errors: [
            {
              type: 'NOT_FOUND',
              path: ['repository', 'ref', 'target', 'file'],
              message: "Could not resolve file for path 'content'."
            }
          ]
        })
      }
      return Response.json({
        data: {
          createCommitOnBranch: {
            commit: {oid: 'commit-oid', file: {oid: 'into-sha'}}
          }
        }
      })
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const api = new GithubApi({
      authToken: 'token',
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      rootDir: '',
      contentDir: 'content'
    })
    const result = await api.write({
      description: 'First entry',
      fromSha: ReadonlyTree.EMPTY.sha,
      intoSha: 'into-sha',
      changes: []
    })
    test.equal(result, {sha: 'into-sha'})
    test.is(graphQlCalls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('commits as the configured author through REST', async () => {
  const originalFetch = globalThis.fetch
  const rest: Array<{method: string; path: string; body: unknown}> = []
  let graphQlCalls = 0
  let commitOid: unknown
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      if (url === 'https://uploads.example/image.jpg')
        return new Response('image')
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      if (url === 'https://api.github.com/graphql') {
        graphQlCalls += 1
        if (graphQlCalls === 1)
          return Response.json({
            data: {
              repository: {
                ref: {
                  target: {
                    oid: 'head-oid',
                    tree: {oid: 'head-tree'},
                    file: {oid: 'from-sha'}
                  }
                }
              }
            }
          })
        commitOid =
          isRecord(body) && isRecord(body.variables) && body.variables.oid
        return Response.json({
          data: {
            repository: {
              object: {
                oid: 'commit-oid',
                tree: {oid: 'new-tree'},
                file: {oid: 'into-sha'}
              }
            }
          }
        })
      }
      const prefix = 'https://api.github.com/repos/owner/repo/'
      if (!url.startsWith(prefix)) throw new Error(`Unexpected request ${url}`)
      const path = url.slice(prefix.length)
      rest.push({method: init?.method ?? 'GET', path, body})
      if (path === 'git/blobs') return Response.json({sha: 'image-blob'})
      if (path === 'git/trees') return Response.json({sha: 'new-tree'})
      if (path === 'git/commits') return Response.json({sha: 'commit-oid'})
      return Response.json({object: {sha: 'commit-oid'}})
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const api = new GithubApi({
      authToken: 'token',
      owner: 'owner',
      repo: 'repo',
      branch: 'feature/cms',
      rootDir: '',
      contentDir: 'content',
      author: {name: 'CMS', email: 'cms@example.com'}
    })
    const result = await api.write({
      description: 'Update',
      user: {
        sub: 'ada@example.com',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        roles: ['admin']
      },
      fromSha: 'from-sha',
      intoSha: 'into-sha',
      changes: [
        {op: 'addContent', path: 'pages/a.json', sha: 'a', contents: '{}'},
        {op: 'deleteContent', path: 'pages/b.json', sha: 'b'},
        {
          op: 'uploadFile',
          url: 'https://uploads.example/image.jpg',
          location: 'public/image.jpg'
        }
      ]
    })
    test.equal(result, {sha: 'into-sha'})
    test.is(commitOid, 'commit-oid')
    test.equal(rest, [
      {
        method: 'POST',
        path: 'git/blobs',
        body: {content: 'aW1hZ2U=', encoding: 'base64'}
      },
      {
        method: 'POST',
        path: 'git/trees',
        body: {
          base_tree: 'head-tree',
          tree: [
            {
              path: 'content/pages/a.json',
              mode: '100644',
              type: 'blob',
              content: '{}'
            },
            {
              path: 'content/pages/b.json',
              mode: '100644',
              type: 'blob',
              sha: null
            },
            {
              path: 'public/image.jpg',
              mode: '100644',
              type: 'blob',
              sha: 'image-blob'
            }
          ]
        }
      },
      {
        method: 'POST',
        path: 'git/commits',
        body: {
          message: 'Update\n\nCo-authored-by: Ada Lovelace <ada@example.com>',
          tree: 'new-tree',
          parents: ['head-oid'],
          author: {name: 'CMS', email: 'cms@example.com'}
        }
      },
      {
        method: 'PATCH',
        path: 'git/refs/heads/feature/cms',
        body: {sha: 'commit-oid', force: false}
      }
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reports a branch that moved during a REST commit as a conflict', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      if (url === 'https://api.github.com/graphql')
        return Response.json({
          data: {
            repository: {
              ref: {
                target: {
                  oid: 'head-oid',
                  tree: {oid: 'head-tree'},
                  file: {oid: 'from-sha'}
                }
              }
            }
          }
        })
      if (init?.method === 'PATCH')
        return Response.json(
          {message: 'Update is not a fast forward'},
          {status: 422}
        )
      return Response.json({sha: 'sha'})
    },
    {preconnect: originalFetch.preconnect}
  )
  try {
    const api = new GithubApi({
      authToken: 'token',
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      rootDir: '',
      contentDir: 'content',
      author: {name: 'CMS', email: 'cms@example.com'}
    })
    const error = await api
      .write({
        description: 'Update',
        fromSha: 'from-sha',
        intoSha: 'into-sha',
        changes: []
      })
      .catch(error => error)
    test.ok(error instanceof HttpError)
    test.is(error.code, 409)
  } finally {
    globalThis.fetch = originalFetch
  }
})

interface RestCall {
  method: string
  path: string
  body: unknown
}

/**
 * Answer GitHub requests of a REST commit: the head query with the given
 * target, other GraphQL queries with `graphql`, REST calls with `rest`.
 */
function mockRestCommit(options: {
  target: object
  graphql?: (body: unknown) => object
  rest: (call: RestCall) => Response
}) {
  const originalFetch = globalThis.fetch
  const calls: Array<RestCall> = []
  let graphQlCalls = 0
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      if (url === 'https://api.github.com/graphql') {
        graphQlCalls += 1
        if (graphQlCalls === 1)
          return Response.json({
            data: {repository: {ref: {target: options.target}}}
          })
        return Response.json(options.graphql?.(body) ?? {})
      }
      const prefix = 'https://api.github.com/repos/owner/repo/'
      const call = {
        method: init?.method ?? 'GET',
        path: url.slice(prefix.length),
        body
      }
      calls.push(call)
      return options.rest(call)
    },
    {preconnect: originalFetch.preconnect}
  )
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch
    }
  }
}

const authoredApi = () =>
  new GithubApi({
    authToken: 'token',
    owner: 'owner',
    repo: 'repo',
    branch: 'main',
    rootDir: '',
    contentDir: 'content',
    author: {name: 'CMS', email: 'cms@example.com'}
  })

const head = {
  oid: 'head-oid',
  tree: {oid: 'head-tree'},
  file: {oid: 'from-sha'}
}

test('refuses a REST commit without the tree of its parent', async () => {
  const mock = mockRestCommit({
    target: {oid: 'head-oid', file: {oid: 'from-sha'}},
    rest: () => Response.json({sha: 'sha'})
  })
  try {
    const error = await authoredApi()
      .write({
        description: 'Update',
        fromSha: 'from-sha',
        intoSha: 'into-sha',
        changes: [{op: 'addContent', path: 'a.json', sha: 'a', contents: '{}'}]
      })
      .catch(error => error)
    test.ok(error instanceof Error)
    test.equal(mock.calls, [])
  } finally {
    mock.restore()
  }
})

test('reports a refused ref update that is not a conflict as is', async () => {
  const mock = mockRestCommit({
    target: head,
    rest: call =>
      call.method === 'PATCH'
        ? Response.json(
            {message: 'Protected branch update failed'},
            {status: 422}
          )
        : Response.json({sha: 'sha'})
  })
  try {
    const error = await authoredApi()
      .write({
        description: 'Update',
        fromSha: 'from-sha',
        intoSha: 'into-sha',
        changes: []
      })
      .catch(error => error)
    test.ok(error instanceof HttpError)
    test.is(error.code, 422)
  } finally {
    mock.restore()
  }
})

test('leaves out removals of paths the parent does not have', async () => {
  let trees = 0
  const mock = mockRestCommit({
    target: head,
    graphql(body) {
      const variables = isRecord(body) ? body.variables : undefined
      if (isRecord(variables) && 'p0' in variables)
        return {
          data: {repository: {p0: null, p1: {oid: 'kept'}}}
        }
      return {
        data: {
          repository: {
            object: {
              oid: 'commit-oid',
              tree: {oid: 'new-tree'},
              file: {oid: 'into-sha'}
            }
          }
        }
      }
    },
    rest(call) {
      if (call.path === 'git/trees' && trees++ === 0)
        return Response.json({message: 'GitRPC::BadObjectState'}, {status: 422})
      if (call.path === 'git/commits') return Response.json({sha: 'commit-oid'})
      return Response.json({sha: 'new-tree'})
    }
  })
  try {
    const result = await authoredApi().write({
      description: 'Update',
      fromSha: 'from-sha',
      intoSha: 'into-sha',
      changes: [
        {op: 'deleteContent', path: 'gone.json', sha: 'g'},
        {op: 'deleteContent', path: 'kept.json', sha: 'k'}
      ]
    })
    test.equal(result, {sha: 'into-sha'})
    const retried = mock.calls.filter(call => call.path === 'git/trees')[1]
    test.equal(retried?.body, {
      base_tree: 'head-tree',
      tree: [
        {path: 'content/kept.json', mode: '100644', type: 'blob', sha: null}
      ]
    })
  } finally {
    mock.restore()
  }
})
