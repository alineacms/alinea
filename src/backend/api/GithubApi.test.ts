import type {CommitRequest} from '#/core/db/CommitRequest.js'
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
                    oid: 'head-oid'
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
                oid: 'commit-oid'
              }
            }
          }
        })
      }

      const sha = url.endsWith('ref=head-oid') ? fromSha : intoSha
      return Response.json([{path: 'content', sha}])
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
      checks: [],
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
