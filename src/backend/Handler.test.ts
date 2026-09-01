import {composeBackend} from '#/backend/api/CreateBackend.js'
import {MissingCredentialsError} from '#/backend/Auth.js'
import {createHandler} from '#/backend/Handler.js'
import {AuthResultType} from '#/cloud/AuthResult.js'
import {createCMS} from '#/core.js'
import type {
  AuthOptions,
  AuthedContext,
  RequestContext
} from '#/core/Connection.js'
import {developmentKeyHeader} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {role} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {Config} from '#/index.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {}
})

const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages')
  }
})

test('requires member management capability for user management', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main},
    roles: {
      editor: role('Editor', {
        permissions() {}
      }),
      owner: role('Owner', {
        permissions(policy) {
          policy.set({
            allow: {
              manageMembers: true
            }
          })
        }
      })
    }
  })
  const db = new LocalDB(cms.config)
  let userRoles = ['editor']
  let listCalls = 0
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend({
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {
              email: 'ada@example.com',
              roles: userRoles,
              sub: 'ada@example.com'
            }
          }
        },
        async enrichUser(user: User): Promise<User> {
          return user
        },
        async listUsers(): Promise<Array<User>> {
          listCalls += 1
          return []
        }
      })
    }
  })

  const denied = await handle(userRequest('list'), requestContext())
  test.is(denied.status, 401)
  test.is(listCalls, 0)

  userRoles = ['owner']
  const allowed = await handle(userRequest('list'), requestContext())
  test.is(allowed.status, 200)
  test.is(listCalls, 1)
})

test('reports missing user api capability without listUsers', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main}
  })
  const db = new LocalDB(cms.config)
  const handle = createHandler({
    cms,
    db,
    remote() {
      return composeBackend({})
    }
  })

  const response = await handle(capabilitiesRequest(), requestContext())
  test.is(response.status, 200)
  test.equal(await response.json(), {
    users: false
  })
})

test('reports user api capability when listUsers exists', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main}
  })
  const db = new LocalDB(cms.config)
  const handle = createHandler({
    cms,
    db,
    remote() {
      return composeBackend({
        async listUsers(): Promise<Array<User>> {
          return []
        }
      })
    }
  })

  const response = await handle(capabilitiesRequest(), requestContext())
  test.is(response.status, 200)
  test.equal(await response.json(), {
    users: true
  })
})

test('enriches authenticated user in auth status response', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main}
  })
  const db = new LocalDB(cms.config)
  const handle = createHandler({
    cms,
    db,
    remote() {
      return composeBackend({
        async authenticate(
          _request: Request,
          options?: AuthOptions
        ): Promise<Response> {
          const user = {
            email: 'ada@example.com',
            roles: [],
            sub: 'ada@example.com'
          }
          return Response.json({
            type: AuthResultType.Authenticated,
            user: options?.enrichUser ? await options.enrichUser(user) : user
          })
        },
        async enrichUser(user: User): Promise<User> {
          return {...user, roles: ['admin']}
        }
      })
    }
  })

  const response = await handle(authStatusRequest(), requestContext())

  test.is(response.status, 200)
  test.equal(await response.json(), {
    type: AuthResultType.Authenticated,
    user: {
      email: 'ada@example.com',
      roles: ['admin'],
      sub: 'ada@example.com'
    }
  })
})

test('adds enriched user to commit requests', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main}
  })
  const db = new LocalDB(cms.config)
  let commitUser: User | undefined
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend({
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {
              email: 'ada@example.com',
              roles: ['admin'],
              sub: 'ada@example.com'
            }
          }
        },
        async enrichUser(user: User): Promise<User> {
          return {...user, name: 'Ada Lovelace'}
        },
        async getTreeIfDifferent() {
          return undefined
        },
        async *getBlobs() {},
        async write(request) {
          commitUser = request.user
          return {sha: request.intoSha}
        }
      })
    }
  })

  const response = await handle(
    new Request('http://localhost/api?action=mutate', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify([])
    }),
    requestContext()
  )

  test.is(response.status, 200)
  test.equal(commitUser, {
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    roles: ['admin'],
    sub: 'ada@example.com'
  })
})

test('forwards authenticated mutations before handling them locally', async () => {
  const cms = createCMS({schema: {Page}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  let beforeCreateCalls = 0
  let forwardedUser: User | undefined
  let forwardedMutations: unknown
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend({
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test-token',
            user: {roles: ['admin'], sub: 'admin'}
          }
        },
        async enrichUser(user: User): Promise<User> {
          return {...user, name: 'Admin'}
        }
      })
    },
    async forwardMutations(request, context) {
      forwardedUser = context.user
      forwardedMutations = await request.json()
      return Response.json({sha: 'forwarded'})
    },
    beforeCreate() {
      beforeCreateCalls += 1
    }
  })
  const mutations = [
    {
      op: 'create',
      id: 'forwarded-entry',
      type: 'Page',
      locale: null,
      data: {title: 'Forwarded'}
    }
  ]

  const response = await handle(mutationRequest(mutations), requestContext())

  test.is(response.status, 200)
  test.equal(await response.json(), {sha: 'forwarded'})
  test.equal(forwardedMutations, mutations)
  test.equal(forwardedUser, {
    name: 'Admin',
    roles: ['admin'],
    sub: 'admin'
  })
  test.is(beforeCreateCalls, 0)
  test.not.ok(db.index.findFirst(entry => entry.id === 'forwarded-entry'))
})

test('runs mutation hooks around a successful commit', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main}
  })
  const db = new LocalDB(cms.config)
  const calls: Array<string> = []
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, {
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        }
      })
    },
    beforeCreate(entry) {
      calls.push(`beforeCreate:${entry.data.title}`)
      return {
        ...entry,
        data: {...entry.data, title: 'Created by hook'}
      }
    },
    afterCreate(entry) {
      calls.push(`afterCreate:${entry.data.title}`)
    },
    beforeUpdate(entry) {
      calls.push(`beforeUpdate:${entry.data.title}`)
      return {
        ...entry,
        data: {...entry.data, title: 'Updated by hook'}
      }
    },
    afterUpdate(entry) {
      calls.push(`afterUpdate:${entry.data.title}`)
    },
    beforeArchive(entryId) {
      calls.push(`beforeArchive:${entryId}`)
    },
    afterArchive(entryId) {
      calls.push(`afterArchive:${entryId}`)
    },
    beforeRemove(entryId) {
      calls.push(`beforeRemove:${entryId}`)
    },
    afterRemove(entryId) {
      calls.push(`afterRemove:${entryId}`)
    }
  })

  const createResponse = await handle(
    mutationRequest([
      {
        op: 'create',
        id: 'hook-entry',
        type: 'Page',
        locale: null,
        data: {title: 'Original'}
      }
    ]),
    requestContext()
  )
  test.is(createResponse.status, 200)

  const updateResponse = await handle(
    mutationRequest([
      {
        op: 'update',
        id: 'hook-entry',
        locale: null,
        status: 'published',
        set: {title: 'Requested update'}
      }
    ]),
    requestContext()
  )
  test.is(updateResponse.status, 200)

  const archiveResponse = await handle(
    mutationRequest([{op: 'archive', id: 'hook-entry', locale: null}]),
    requestContext()
  )
  test.is(archiveResponse.status, 200)

  const removeResponse = await handle(
    mutationRequest([{op: 'remove', id: 'hook-entry'}]),
    requestContext()
  )
  test.is(removeResponse.status, 200)

  test.equal(calls, [
    'beforeCreate:Original',
    'afterCreate:Created by hook',
    'beforeUpdate:Requested update',
    'afterUpdate:Updated by hook',
    'beforeArchive:hook-entry',
    'afterArchive:hook-entry',
    'beforeRemove:hook-entry',
    'afterRemove:hook-entry'
  ])
})

test('projects batched hook entries in mutation order', async () => {
  const cms = createCMS({schema: {Page}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  const updates: Array<string> = []
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, {
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        }
      })
    },
    beforeUpdate(entry) {
      updates.push(`before:${entry.data.title}`)
    },
    afterUpdate(entry) {
      updates.push(`after:${entry.data.title}`)
    }
  })

  await handle(
    mutationRequest([
      {
        op: 'create',
        id: 'batch-entry',
        type: 'Page',
        locale: null,
        data: {title: 'Original'}
      }
    ]),
    requestContext()
  )
  const response = await handle(
    mutationRequest([
      {
        op: 'update',
        id: 'batch-entry',
        locale: null,
        status: 'published',
        set: {title: 'Updated'}
      },
      {op: 'archive', id: 'batch-entry', locale: null}
    ]),
    requestContext()
  )

  test.is(response.status, 200)
  test.equal(updates, ['before:Updated', 'after:Updated'])
})

test('keeps nested in-place changes returned by before hooks', async () => {
  const cms = createCMS({schema: {Page}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, {
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        }
      })
    },
    beforeUpdate(entry) {
      const nested = entry.data.nested as {value: string}
      nested.value = 'Changed by hook'
      return entry
    }
  })

  await handle(
    mutationRequest([
      {
        op: 'create',
        id: 'nested-entry',
        type: 'Page',
        locale: null,
        data: {title: 'Nested', nested: {value: 'Original'}}
      }
    ]),
    requestContext()
  )
  const response = await handle(
    mutationRequest([
      {
        op: 'update',
        id: 'nested-entry',
        locale: null,
        status: 'published',
        set: {title: 'Updated'}
      }
    ]),
    requestContext()
  )
  const entry = db.index.findFirst(entry => entry.id === 'nested-entry')

  test.is(response.status, 200)
  test.equal(entry?.data.nested, {value: 'Changed by hook'})
})

test('does not report a committed mutation as failed when an after hook throws', async () => {
  const cms = createCMS({schema: {Page}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, {
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        }
      })
    },
    afterCreate() {
      throw new Error('After hook failed')
    }
  })
  const error = console.error
  console.error = () => {}
  try {
    const response = await handle(
      mutationRequest([
        {
          op: 'create',
          id: 'committed-entry',
          type: 'Page',
          locale: null,
          data: {title: 'Committed'}
        }
      ]),
      requestContext()
    )

    test.is(response.status, 200)
    test.ok(db.index.findFirst(entry => entry.id === 'committed-entry'))
  } finally {
    console.error = error
  }
})

test('retries a forwarded commit conflict by response status', async () => {
  const cms = createCMS({schema: {Page}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  let writes = 0
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, {
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        },
        async write(request) {
          writes += 1
          if (writes === 1)
            throw Response.json({error: 'Conflict'}, {status: 409})
          return db.write(request)
        }
      })
    }
  })

  const response = await handle(
    mutationRequest([
      {
        op: 'create',
        id: 'retry-entry',
        type: 'Page',
        locale: null,
        data: {title: 'Retry'}
      }
    ]),
    requestContext()
  )

  test.is(response.status, 200)
  test.is(writes, 2)
})

test('accepts authenticated commits only in development', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main}
  })
  const db = new LocalDB(cms.config)
  await db.sync()
  const tree = await db.source.getTree()
  const commit = {
    fromSha: tree.sha,
    intoSha: tree.sha,
    description: 'Empty commit',
    user: {roles: ['admin'], sub: 'spoofed'},
    changes: []
  }
  let committedUser: User | undefined
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, {
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        },
        async write(request) {
          committedUser = request.user
          return db.write(request)
        }
      })
    }
  })

  const accepted = await handle(commitRequest(commit, 'test'), requestContext())
  test.is(accepted.status, 200)
  test.equal(committedUser, {roles: ['admin'], sub: 'admin'})

  const rejected = await handle(commitRequest(commit), requestContext())
  test.is(rejected.status, 401)

  const production = await handle(commitRequest(commit, 'test'), {
    ...requestContext(),
    isDev: false
  })
  test.is(production.status, 400)

  const withoutUser = createHandler({
    cms,
    db,
    remote() {
      return composeBackend(db, {
        async verify(): Promise<AuthedContext> {
          throw new MissingCredentialsError('Missing user credentials')
        }
      })
    }
  })
  const unauthenticated = await withoutUser(
    commitRequest(commit, 'test'),
    requestContext()
  )
  test.is(unauthenticated.status, 401)
})

test('rejects oversized uploads before preparing a remote upload', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main},
    maxUploadSize: 3
  })
  const db = new LocalDB(cms.config)
  let prepareCalls = 0
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend({
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        },
        async prepareUpload() {
          prepareCalls += 1
          throw new Error('Should not prepare an oversized upload')
        }
      })
    }
  })

  const response = await handle(
    new Request('http://localhost/api?action=upload', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({filename: 'large.jpg', size: 4})
    }),
    requestContext()
  )

  test.is(response.status, 413)
  test.is(prepareCalls, 0)
})

function userRequest(operation: string): Request {
  return new Request(
    `http://localhost/api?action=user&operation=${operation}`,
    {
      headers: {
        accept: 'application/json'
      }
    }
  )
}

function authStatusRequest(): Request {
  return new Request('http://localhost/api?auth=status', {
    headers: {
      accept: 'application/json'
    }
  })
}

function capabilitiesRequest(): Request {
  return new Request('http://localhost/api?action=capabilities', {
    headers: {
      accept: 'application/json'
    }
  })
}

function mutationRequest(mutations: Array<unknown>): Request {
  return new Request('http://localhost/api?action=mutate', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify(mutations)
  })
}

function commitRequest(commit: unknown, apiKey?: string): Request {
  return new Request('http://localhost/api?action=commit', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(apiKey ? {[developmentKeyHeader]: apiKey} : {})
    },
    body: JSON.stringify(commit)
  })
}

function requestContext(): RequestContext {
  return {
    apiKey: 'test',
    handlerUrl: new URL('http://localhost/api'),
    isDev: true
  }
}
