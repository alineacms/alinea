import {composeBackend} from '#/backend/api/CreateBackend.js'
import {createHandler} from '#/backend/Handler.js'
import {AuthResultType} from '#/cloud/AuthResult.js'
import {createCMS} from '#/core.js'
import type {
  AuthOptions,
  AuthedContext,
  RequestContext
} from '#/core/Connection.js'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {role} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {Config} from '#/index.js'
import {ReplicaService} from '#/database/handler/Service.js'
import type {RuntimeDatabaseIndex} from '#/database/runtime/Model.js'
import {RuntimeEntryStore} from '#/database/runtime/Store.js'
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
  const db = new SourceDB(cms.config)
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
  const db = new SourceDB(cms.config)
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
  const db = new SourceDB(cms.config)
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
  const db = new SourceDB(cms.config)
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
  const db = new SourceDB(cms.config)
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

test('rejects oversized uploads before preparing a remote upload', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main},
    maxUploadSize: 3
  })
  const db = new SourceDB(cms.config)
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

test('serves replica bootstrap and state only after authentication', async () => {
  const cms = createCMS({schema: {Page}, workspaces: {main}})
  const db = new SourceDB(cms.config)
  const runtime: RuntimeDatabaseIndex = {
    version: 1,
    revision: 'tree-1',
    bundleId: 'release-1',
    bundleUrl: '/admin/release/release-1/database.bin',
    entries: [],
    children: {}
  }
  const store = new RuntimeEntryStore({
    index: runtime,
    source: () => ({
      async read() {
        return new Uint8Array()
      }
    })
  })
  const replica = new ReplicaService({
    config: cms.config,
    configId: 'config-1',
    configUrl: '/admin/config/config-1/client-config.js',
    cacheKey: 'cache-1',
    runtime,
    store
  })
  const handle = createHandler({
    cms,
    db,
    replica,
    remote(context) {
      return composeBackend({
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        },
        async enrichUser(user: User): Promise<User> {
          return user
        },
        async getTreeIfDifferent() {
          return undefined
        },
        async write(request) {
          return {sha: request.intoSha}
        }
      })
    }
  })
  const bootstrap = await handle(
    new Request('http://localhost/api?action=replicaBootstrap', {
      headers: {accept: 'application/json'}
    }),
    requestContext()
  )
  test.is(bootstrap.status, 200)
  test.is(
    (await bootstrap.json()).configUrl,
    '/admin/config/config-1/client-config.js'
  )
  const state = await handle(
    new Request('http://localhost/api?action=replicaState', {
      headers: {accept: 'application/json'}
    }),
    requestContext()
  )
  test.is(state.status, 200)
  test.is((await state.json()).runtime.revision, 'tree-1')
  const unchanged = await handle(
    new Request('http://localhost/api?action=replicaState&revision=tree-1', {
      headers: {accept: 'application/json'}
    }),
    requestContext()
  )
  test.is(unchanged.status, 204)
  const eligible = await handle(
    new Request('http://localhost/api?action=replicaEligible', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({filter: {title: 'Example'}})
    }),
    requestContext()
  )
  test.is(eligible.status, 200)
  test.equal(await eligible.json(), [])
  const command = await handle(
    new Request('http://localhost/api?action=replicaCommand', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify([])
    }),
    requestContext()
  )
  test.is(command.status, 200)
  test.is((await command.json()).revision, replica.revision)
  replica.installRuntimeOverlay(
    runtime,
    'overlay-1',
    new Uint8Array([0, 1, 2, 3])
  )
  const range = await handle(
    new Request('http://localhost/api?action=replicaBundle&bundle=overlay-1', {
      headers: {range: 'bytes=1-2'}
    }),
    requestContext()
  )
  test.is(range.status, 206)
  test.equal(new Uint8Array(await range.arrayBuffer()), new Uint8Array([1, 2]))
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

function requestContext(): RequestContext {
  return {
    apiKey: 'test',
    handlerUrl: new URL('http://localhost/api'),
    isDev: true
  }
}
