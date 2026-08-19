import {composeBackend} from '#/backend/api/CreateBackend.js'
import {createHandler} from '#/backend/Handler.js'
import {AuthResultType} from '#/cloud/AuthResult.js'
import {createCMS} from '#/core.js'
import type {
  AuthOptions,
  AuthedContext,
  RequestContext
} from '#/core/Connection.js'
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

test('serves dashboard bootstrap and content state only through user access', async () => {
  const cms = createCMS({
    schema: {Page},
    workspaces: {main}
  })
  const db = new LocalDB(cms.config)
  const handle = createHandler({
    cms,
    db,
    release: {configId: 'config-release', adminPath: 'admin'},
    remote(context) {
      return composeBackend({
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        },
        async getTreeIfDifferent() {
          return undefined
        },
        async *getBlobs() {}
      })
    }
  })

  const bootstrap = await handle(
    new Request('http://localhost/api?action=bootstrap', {
      headers: {accept: 'application/json'}
    }),
    requestContext()
  )
  test.is(bootstrap.status, 200)
  const bootstrapData = await bootstrap.json()
  test.equal(
    {
      ...bootstrapData,
      cacheKey: typeof bootstrapData.cacheKey
    },
    {
      configId: 'config-release',
      moduleUrl: '/admin/release/config-release/config.js',
      styleUrl: '/admin/release/config-release/config.css',
      cacheKey: 'string'
    }
  )
  test.is(bootstrap.headers.get('cache-control'), 'private, no-store')

  const content = await handle(
    new Request('http://localhost/api?action=contentState', {
      headers: {accept: 'application/json'}
    }),
    requestContext()
  )
  test.is(content.status, 200)
  const state = await content.json()
  test.is(state.configId, 'config-release')
  test.equal(state.entries, {})

  const rawTree = await handle(
    new Request('http://localhost/api?action=tree&sha=current', {
      headers: {accept: 'application/json'}
    }),
    requestContext()
  )
  test.is(rawTree.status, 401)

  const internalTree = await handle(
    new Request('http://localhost/api?action=tree&sha=current', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer internal'
      }
    }),
    {...requestContext(), internalToken: 'internal'}
  )
  test.is(internalTree.status, 200)
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
