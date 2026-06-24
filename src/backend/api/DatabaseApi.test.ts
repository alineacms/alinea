import type {RequestContext} from '#/core/Connection.js'
import {suite} from '@alinea/suite'
import {Database as BunSqlite} from 'bun:sqlite'
import * as driver from 'rado/driver'
import {DatabaseApi} from './DatabaseApi.js'

const test = suite(import.meta)

test('users are matched case-insensitively and roles are replaced', async () => {
  const sqlite = new BunSqlite(':memory:')
  const api = new DatabaseApi(testContext(), {
    db: driver['bun:sqlite'](sqlite)
  })
  try {
    const created = await api.createUser({
      sub: 'ADA@example.com',
      email: 'ADA@example.com',
      name: ' Ada ',
      roles: ['admin', 'admin', 'editor']
    })
    test.is(created.sub, 'ada@example.com')
    test.is(created.email, 'ada@example.com')
    test.is(created.name, 'Ada')
    test.equal(created.roles, ['admin', 'editor'])

    const updated = await api.createUser({
      sub: 'ada@EXAMPLE.com',
      email: 'ada@EXAMPLE.com',
      name: 'Ada Lovelace',
      roles: ['editor']
    })
    test.is(updated.sub, 'ada@example.com')
    test.is(updated.email, 'ada@example.com')
    test.is(updated.name, 'Ada Lovelace')
    test.equal(updated.roles, ['editor'])

    const enriched = await api.enrichUser({
      sub: 'ADA@EXAMPLE.COM',
      email: 'ADA@EXAMPLE.COM',
      roles: []
    })
    test.is(enriched.sub, 'ada@example.com')
    test.is(enriched.name, 'Ada Lovelace')

    const users = await api.listUsers()
    test.is(users.length, 1)
  } finally {
    sqlite.close()
  }
})

function testContext(): RequestContext {
  return {
    isDev: true,
    handlerUrl: new URL('http://localhost/api'),
    apiKey: 'test'
  }
}
