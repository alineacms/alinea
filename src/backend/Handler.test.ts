import {Request, Response} from '@alinea/iso'
import {suite} from '@alinea/suite'
import {Config} from 'alinea'
import {MissingCredentialsError} from 'alinea/backend/Auth'
import {createHandler} from 'alinea/backend/Handler'
import type {RemoteConnection, RequestContext} from 'alinea/core/Connection'
import {createCMS} from 'alinea/core'
import type {CommitRequest} from 'alinea/core/db/CommitRequest'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {Policy} from 'alinea/core/Role'

const test = suite(import.meta)

const uploader = Config.role('Uploader', {
  permissions(policy) {
    policy.set({allow: {upload: true}})
  }
})

const viewer = Config.role('Viewer', {
  permissions() {}
})

const Page = Config.document('Page', {fields: {}})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {contains: [Page]})
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main},
  roles: {uploader, viewer}
})

function context(): RequestContext {
  return {
    isDev: true,
    handlerUrl: new URL('http://localhost/api'),
    apiKey: 'secret'
  }
}

test('upload prepare requires upload permission', async () => {
  let prepareCalls = 0
  const remote = ((ctx: RequestContext) => {
    return {
      authenticate: async () => new Response('auth'),
      verify: async (request: Request) => {
        const bearer = request.headers.get('authorization')
        const user =
          bearer === 'Bearer secret'
            ? {name: 'Uploader', roles: ['uploader']}
            : {name: 'Viewer', roles: ['viewer']}
        return {...ctx, user, token: 'token'}
      },
      prepareUpload: async () => {
        prepareCalls++
        return {
          entryId: 'e1',
          location: 'uploads/test.jpg',
          previewUrl: 'http://localhost/api?action=upload&entryId=e1',
          url: 'http://localhost/upload'
        }
      }
    } as unknown as RemoteConnection
  }) as (context: RequestContext) => RemoteConnection

  const db = new LocalDB(cms.config)
  const handler = createHandler({cms, db, remote})

  const denied = await handler(
    new Request('http://localhost/api?action=upload', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({filename: 'test.jpg'})
    }),
    context()
  )
  test.is(denied.status, 401)
  test.is(prepareCalls, 0)

  const allowed = await handler(
    new Request('http://localhost/api?action=upload', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer secret'
      },
      body: JSON.stringify({filename: 'test.jpg'})
    }),
    context()
  )
  test.is(allowed.status, 200)
  test.is(prepareCalls, 1)
})

test('upload blob requires upload permission', async () => {
  let blobCalls = 0
  const remote = ((ctx: RequestContext) => {
    return {
      authenticate: async () => new Response('auth'),
      verify: async (request: Request) => {
        const bearer = request.headers.get('authorization')
        const user =
          bearer === 'Bearer secret'
            ? {name: 'Uploader', roles: ['uploader']}
            : {name: 'Viewer', roles: ['viewer']}
        return {...ctx, user, token: 'token'}
      },
      handleUpload: async () => {
        blobCalls++
      }
    } as unknown as RemoteConnection
  }) as (context: RequestContext) => RemoteConnection

  const db = new LocalDB(cms.config)
  const handler = createHandler({cms, db, remote})

  const denied = await handler(
    new Request('http://localhost/api?action=upload&entryId=e1', {
      method: 'POST',
      headers: {
        accept: 'application/json'
      },
      body: new Blob(['abc'])
    }),
    context()
  )
  test.is(denied.status, 401)
  test.is(blobCalls, 0)

  const allowed = await handler(
    new Request('http://localhost/api?action=upload&entryId=e1', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer secret'
      },
      body: new Blob(['abc'])
    }),
    context()
  )
  test.is(allowed.status, 200)
  test.is(blobCalls, 1)
})

test('upload preview does not require auth or permissions', async () => {
  let verifyCalls = 0
  let previewCalls = 0
  const remote = ((ctx: RequestContext) => {
    return {
      authenticate: async () => new Response('auth'),
      verify: async () => {
        verifyCalls++
        return {...ctx, user: {name: 'Viewer', roles: ['viewer']}, token: 't'}
      },
      previewUpload: async (entryId: string) => {
        previewCalls++
        return new Response(`preview:${entryId}`, {status: 200})
      }
    } as unknown as RemoteConnection
  }) as (context: RequestContext) => RemoteConnection

  const db = new LocalDB(cms.config)
  const handler = createHandler({cms, db, remote})
  const response = await handler(
    new Request('http://localhost/api?action=upload&entryId=e1', {
      method: 'GET',
      headers: {accept: 'application/json'}
    }),
    context()
  )

  test.is(response.status, 200)
  test.is(await response.text(), 'preview:e1')
  test.is(previewCalls, 1)
  test.is(verifyCalls, 0)
})

const fakeCommitRequest: CommitRequest = {
  description: 'test',
  fromSha: 'abc123',
  intoSha: 'def456',
  checks: [],
  changes: []
}

test('mutate with authenticated user creates and enforces policy', async () => {
  let createPolicyCalls: Array<Array<string>> = []
  let requestPolicies: Array<Policy | false | undefined> = []

  const db = {
    createPolicy: async (roles: Array<string>) => {
      createPolicyCalls.push(roles)
      return Policy.ALLOW_NONE
    },
    syncWith: async () => 'sha',
    request: async (_mutations: unknown, policy: Policy | false | undefined) => {
      requestPolicies.push(policy)
      return fakeCommitRequest
    },
    write: async () => ({sha: 'def456'})
  } as unknown as LocalDB

  const remote = ((ctx: RequestContext) => {
    return {
      authenticate: async () => new Response('auth'),
      verify: async (req: Request) => {
        const bearer = req.headers.get('authorization')
        const user =
          bearer === 'Bearer token'
            ? {name: 'Viewer', roles: ['viewer']}
            : null
        if (!user) throw new MissingCredentialsError('No credentials')
        return {...ctx, user, token: 'token'}
      },
      write: async () => ({sha: 'def456'})
    } as unknown as RemoteConnection
  }) as (context: RequestContext) => RemoteConnection

  const handler = createHandler({cms, db, remote})

  const response = await handler(
    new Request('http://localhost/api?action=mutate', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer token'
      },
      body: JSON.stringify([])
    }),
    context()
  )

  test.is(response.status, 200)
  // Policy must be created from the user's roles
  test.is(createPolicyCalls.length, 1)
  test.equal(createPolicyCalls[0], ['viewer'])
  // The policy must be passed to local.request
  test.is(requestPolicies.length, 1)
  test.ok(requestPolicies[0] instanceof Policy)
})

test('mutate with api key only skips policy creation', async () => {
  let createPolicyCalls = 0
  let requestPolicies: Array<Policy | false | undefined> = []

  const db = {
    createPolicy: async () => {
      createPolicyCalls++
      return Policy.ALLOW_NONE
    },
    syncWith: async () => 'sha',
    request: async (_mutations: unknown, policy: Policy | false | undefined) => {
      requestPolicies.push(policy)
      return fakeCommitRequest
    },
    write: async () => ({sha: 'def456'})
  } as unknown as LocalDB

  const remote = ((ctx: RequestContext) => {
    return {
      authenticate: async () => new Response('auth'),
      verify: async () => {
        throw new MissingCredentialsError('No credentials')
      },
      write: async () => ({sha: 'def456'})
    } as unknown as RemoteConnection
  }) as (context: RequestContext) => RemoteConnection

  const handler = createHandler({cms, db, remote})

  // Request authenticated only via API key (bearer matches context.apiKey)
  const response = await handler(
    new Request('http://localhost/api?action=mutate', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${context().apiKey}`
      },
      body: JSON.stringify([])
    }),
    context()
  )

  test.is(response.status, 200)
  // No policy should be created when there is no authenticated user
  test.is(createPolicyCalls, 0)
  // local.request is called without a policy (allow-all behavior)
  test.is(requestPolicies.length, 1)
  test.is(requestPolicies[0], undefined)
})
