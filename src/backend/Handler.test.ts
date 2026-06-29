import {createHandler} from '#/backend/Handler.js'
import {createRemote} from '#/backend/api/CreateBackend.js'
import {createCMS} from '#/core.js'
import type {AuthedContext, RequestContext} from '#/core/Connection.js'
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
      return createRemote({
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
      return createRemote({})
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
      return createRemote({
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

function userRequest(operation: string): Request {
  return new Request(`http://localhost/api?action=user&operation=${operation}`, {
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
