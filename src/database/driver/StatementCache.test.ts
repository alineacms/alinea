import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {sql} from 'rado'
import {connect} from 'rado/driver/bun-sqlite'
import {cacheStatements} from './StatementCache.js'

test('statements are reused across rado queries until evicted', async () => {
  const sqlite = cacheStatements(new Database(':memory:'), 2)
  const db = connect(sqlite)
  await db.run(sql`create table item (id integer primary key, name text)`)
  await db.run(sql`insert into item (name) values (${'a'}), (${'b'})`)
  const byId = (id: number) =>
    db.get<{name: string}>(sql`select name from item where id = ${id}`)
  expect(await byId(1)).toEqual({name: 'a'})
  // Rado finalized the statement after the first query; it still runs.
  expect(await byId(2)).toEqual({name: 'b'})
  const statement = sqlite.prepare('select name from item where id = ?')
  expect(sqlite.prepare('select name from item where id = ?')).toBe(statement)
  sqlite.prepare('select 1')
  sqlite.prepare('select 2')
  // Evicted statements are finalized and no longer returned.
  expect(() => statement.get(1)).toThrow()
  expect(sqlite.prepare('select name from item where id = ?')).not.toBe(
    statement
  )
  sqlite.close()
})
