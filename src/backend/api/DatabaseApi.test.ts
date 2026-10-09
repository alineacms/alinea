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

    await api.removeUser('ADA@EXAMPLE.COM')
    test.equal(await api.listUsers(), [])
  } finally {
    sqlite.close()
  }
})

test('blobs are stored once and found by their sha', async () => {
  const sqlite = new BunSqlite(':memory:')
  const api = new DatabaseApi(testContext(), {
    db: driver['bun:sqlite'](sqlite)
  })
  const first = new TextEncoder().encode('{"title": "First"}')
  const second = new TextEncoder().encode('{"title": "Second"}')
  await api.storeBlobs([['a'.repeat(40), first]])
  // Storing a blob again, as another instance may, keeps the first copy
  await api.storeBlobs([
    ['a'.repeat(40), first],
    ['b'.repeat(40), second]
  ])
  const found = await api.readBlobs([
    'a'.repeat(40),
    'b'.repeat(40),
    'c'.repeat(40)
  ])
  test.equal([...found.keys()].toSorted(), ['a'.repeat(40), 'b'.repeat(40)])
  test.equal(found.get('a'.repeat(40)), first)
  test.equal(found.get('b'.repeat(40)), second)
})

test('blobs no instance used for a month are removed', async () => {
  const sqlite = new BunSqlite(':memory:')
  const api = new DatabaseApi(testContext(), {
    db: driver['bun:sqlite'](sqlite)
  })
  const blob = new TextEncoder().encode('{}')
  await api.storeBlobs([
    ['a'.repeat(40), blob],
    ['b'.repeat(40), blob]
  ])
  const monthAgo = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60
  sqlite.run('update alinea_blob set usedAt = ?', [monthAgo])
  // Read since, so still in use
  await api.readBlobs(['b'.repeat(40)])
  // Cleanup runs at most once an hour per database: a fresh one does
  const later = new DatabaseApi(testContext(), {
    db: driver['bun:sqlite'](sqlite)
  })
  await later.storeBlobs([['c'.repeat(40), blob]])
  const found = await later.readBlobs([
    'a'.repeat(40),
    'b'.repeat(40),
    'c'.repeat(40)
  ])
  test.equal([...found.keys()].toSorted(), ['b'.repeat(40), 'c'.repeat(40)])
})

function testContext(): RequestContext {
  return {
    isDev: true,
    handlerUrl: new URL('http://localhost/api'),
    apiKey: 'test'
  }
}
