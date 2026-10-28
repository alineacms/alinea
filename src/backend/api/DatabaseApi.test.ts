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
    ['b'.repeat(40), second],
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
  const [a, b, c] = ['a', 'b', 'c'].map(char => char.repeat(40))
  await api.storeBlobs([
    [a, blob],
    [b, blob],
    [c, blob]
  ])
  const monthAgo = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60
  sqlite.run('update alinea_blob set usedAt = ?', [monthAgo])
  // Read or stored since, so still in use
  await api.readBlobs([b])
  await api.storeBlobs([[c, blob]])
  // Cleanup runs at most once an hour per database, after reads too: a fresh
  // one does
  const later = new DatabaseApi(testContext(), {
    db: driver['bun:sqlite'](sqlite)
  })
  await later.readBlobs(['d'.repeat(40)])
  const found = await later.readBlobs([a, b, c])
  test.equal([...found.keys()].toSorted(), [b, c])
})

test('blobs are inserted in batches that bind at most 100 parameters', async () => {
  const sqlite = new BunSqlite(':memory:')
  const db = driver['bun:sqlite'](sqlite)
  const target: {prepare(sql: string, options?: object): unknown} = db.driver
  const prepare = target.prepare.bind(target)
  const inserts: Array<number> = []
  // Fail like D1 does on a statement binding more than 100 parameters
  target.prepare = (sql, options) => {
    const params = sql.split('?').length - 1
    if (params > 100) throw new Error('Too many parameters')
    if (sql.startsWith('insert into "alinea_blob"')) inserts.push(params)
    return prepare(sql, options)
  }
  const api = new DatabaseApi(testContext(), {db})
  const blobs = Array.from({length: 120}, (_, index) => {
    const sha = index.toString(16).padStart(40, '0')
    return [sha, new TextEncoder().encode(sha)] as [string, Uint8Array]
  })
  await api.storeBlobs(blobs)
  test.equal(inserts, [99, 99, 99, 63])
  const found = await api.readBlobs(blobs.map(([sha]) => sha))
  test.is(found.size, 120)
})

test('mysql tables index the email and hold large uploads', async () => {
  const queries: Array<string> = []
  const client = {
    async query(query: string | {sql: string}) {
      queries.push(typeof query === 'string' ? query : query.sql)
      return [[], []]
    }
  }
  const api = new DatabaseApi(testContext(), {
    db: driver.mysql2(client as never)
  })
  await api.listUsers()
  const create = (name: string) =>
    queries.find(query => query.startsWith(`create table \`${name}\``))
  test.ok(
    create('alinea_user')?.includes('`email` varchar(255) not null unique')
  )
  test.ok(create('alinea_upload')?.includes('`content` longblob not null'))
  test.ok(create('alinea_blob')?.includes('`content` longblob not null'))
})

test('sqlite keeps its existing column types', async () => {
  const sqlite = new BunSqlite(':memory:')
  const api = new DatabaseApi(testContext(), {
    db: driver['bun:sqlite'](sqlite)
  })
  await api.listUsers()
  const schema = (name: string) =>
    sqlite
      .query<{sql: string}, [string]>(
        'select sql from sqlite_master where name = ?'
      )
      .get(name)?.sql
  test.ok(schema('alinea_user')?.includes('"email" text not null unique'))
  test.ok(schema('alinea_upload')?.includes('"content" blob not null'))
})

function testContext(): RequestContext {
  return {
    isDev: true,
    handlerUrl: new URL('http://localhost/api'),
    apiKey: 'test'
  }
}

test('locks are kept in the database', async () => {
  const sqlite = new BunSqlite(':memory:')
  const db = driver['bun:sqlite'](sqlite)
  const entry = {entryId: 'page', locale: 'en'}
  try {
    const first = new DatabaseApi(testContext(), {db})
    const held = await first.heartbeat({...entry, session: 'x'}, {sub: 'ada'})
    test.equal(held, {holds: true})
    // Another instance sees the same holder
    const second = new DatabaseApi(testContext(), {db})
    const seen = await second.heartbeat({...entry, session: 'y'}, {sub: 'bob'})
    test.is(seen.holds, false)
    test.is(seen.holder?.user.sub, 'ada')
    await first.heartbeat({...entry, session: 'x', leave: true}, {sub: 'ada'})
    const free = await second.heartbeat({...entry, session: 'y'}, {sub: 'bob'})
    test.equal(free, {holds: true})
  } finally {
    sqlite.close()
  }
})
