import {afterEach, expect, test} from 'bun:test'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {GithubApi, type GithubOptions} from './GithubApi.js'
import {gitReceipt} from './GitReceipt.js'

const options: GithubOptions = {
  authToken: 'token',
  owner: 'owner',
  repo: 'repo',
  branch: 'main',
  rootDir: 'site',
  contentDir: 'content'
}
const request: CommitRequest = {
  description: 'Edit',
  fromSha: 'before',
  intoSha: 'after',
  user: {sub: 'user', email: 'user@example.com', name: 'User', roles: []},
  changes: [
    {op: 'addContent', path: 'entry.json', sha: 'blob', contents: '{}'}
  ],
  transaction: {
    id: 'tx',
    namespace: 'main',
    epoch: 'epoch',
    digest: 'a'.repeat(64)
  }
}
const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

interface GraphRequest {
  query: string
  variables: {
    expression: string
    input: {
      expectedHeadOid: string
      fileChanges: {additions: Array<{path: string; contents: string}>}
    }
  }
}

function remote(loseResponse = true, race = false) {
  const files = new Map<string, string>()
  let head = 'head-before'
  let writes = 0
  let headReads = 0
  let release: (() => void) | undefined
  const pinned = new Promise<void>(resolve => {
    release = resolve
  })
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== 'https://api.github.com/graphql')
        return Response.json([
          {
            path: 'site/content',
            sha: head === 'head-before' ? 'before' : 'after'
          }
        ])
      const body = JSON.parse(String(init?.body)) as GraphRequest
      if (body.query.includes('GetLatestCommit')) {
        if (race && headReads < 2) {
          if (++headReads === 2) release?.()
          await pinned
        }
        return Response.json({data: {repository: {ref: {target: {oid: head}}}}})
      }
      if (body.query.includes('GetFileContent')) {
        const path = body.variables.expression.split(':')[1]
        const text = files.get(path)
        return Response.json({
          data: {repository: {object: text === undefined ? null : {text}}}
        })
      }
      const commit = body.variables.input
      if (commit.expectedHeadOid !== head)
        throw new ShaMismatchError(head, commit.expectedHeadOid)
      expect(commit.expectedHeadOid).toBe(head)
      expect(commit.fileChanges.additions.map(file => file.path)).toContain(
        'site/content/entry.json'
      )
      for (const file of commit.fileChanges.additions)
        files.set(file.path, atob(file.contents))
      head = 'head-after'
      writes++
      if (loseResponse) {
        loseResponse = false
        throw new TypeError('Response lost')
      }
      return Response.json({
        data: {createCommitOnBranch: {commit: {oid: head}}}
      })
    },
    {preconnect: originalFetch.preconnect}
  )
  return {
    files,
    get writes() {
      return writes
    }
  }
}

test('Git receipt recovers a lost commit response in a fresh adapter', async () => {
  const source = remote()
  await expect(new GithubApi(options).write(request)).rejects.toThrow(
    'Response lost'
  )
  expect(source.writes).toBe(1)
  expect(source.files.size).toBe(2)
  expect(await new GithubApi(options).write(request)).toEqual({sha: 'after'})
  expect(source.writes).toBe(1)
  await expect(
    new GithubApi(options).write({
      ...request,
      transaction: {...request.transaction!, digest: 'b'.repeat(64)}
    })
  ).rejects.toThrow('already used')
  expect(source.writes).toBe(1)
})

test('concurrent Git submissions publish only one receipt and recover the losing CAS', async () => {
  const source = remote(false, true)
  const results = await Promise.allSettled([
    new GithubApi(options).write(request),
    new GithubApi(options).write(request)
  ])
  expect(results.map(result => result.status).sort()).toEqual([
    'fulfilled',
    'rejected'
  ])
  expect(source.writes).toBe(1)
  expect(await new GithubApi(options).write(request)).toEqual({sha: 'after'})
  expect(source.writes).toBe(1)
})

test('Git receipts isolate authority identities without exposing them in paths', async () => {
  const base = await gitReceipt(options, request)
  expect(base).toBeDefined()
  expect(base!.path).toMatch(
    /^\.alinea\/receipts\/[a-f0-9]{2}\/[a-f0-9]{64}\.json$/
  )
  for (const key of [
    'branch',
    'owner',
    'repo',
    'rootDir',
    'contentDir'
  ] as const)
    expect(
      (await gitReceipt({...options, [key]: 'different'}, request))!.path
    ).not.toBe(base!.path)
  for (const key of ['id', 'namespace', 'epoch'] as const)
    expect(
      (await gitReceipt(options, {
        ...request,
        transaction: {...request.transaction!, [key]: 'different'}
      }))!.path
    ).not.toBe(base!.path)
  expect(
    (await gitReceipt(options, {
      ...request,
      user: {...request.user!, sub: 'different'}
    }))!.path
  ).not.toBe(base!.path)
  await expect(
    gitReceipt({...options, rootDir: '', contentDir: ''}, request)
  ).rejects.toThrow('outside .alinea')
  await expect(
    gitReceipt(options, {...request, user: undefined})
  ).rejects.toThrow('Invalid commit transaction')
})

test('corrupt Git receipts fail closed and mutations cannot delete receipt storage', async () => {
  const source = remote()
  const receipt = (await gitReceipt(options, request))!
  source.files.set(receipt.path, 'not json')
  await expect(new GithubApi(options).write(request)).rejects.toThrow(
    'Invalid durable Git receipt'
  )
  expect(source.writes).toBe(0)
  await expect(
    new GithubApi(options).write({
      ...request,
      transaction: undefined,
      changes: [
        {op: 'removeFile', location: '../.alinea/receipts/receipt.json'}
      ]
    })
  ).rejects.toThrow('reserved Git receipt storage')
  expect(source.writes).toBe(0)
})
