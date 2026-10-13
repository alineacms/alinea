import type {CommitRequest} from '#/core/db/CommitRequest.js'
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
