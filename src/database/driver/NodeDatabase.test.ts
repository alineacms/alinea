import {expect, test} from 'bun:test'
import {DatabaseSync} from 'node:sqlite'
import {checkpointNodeDatabase, nodeDatabase} from './NodeDatabase.js'

test('mutable node databases use the concurrent write policy', () => {
  using sqlite = new DatabaseSync(':memory:')
  nodeDatabase(sqlite, {mutable: true})

  expect(sqlite.prepare('pragma synchronous').get()).toEqual({synchronous: 1})
  expect(sqlite.prepare('pragma busy_timeout').get()).toEqual({timeout: 5000})
  expect(() => checkpointNodeDatabase(sqlite)).not.toThrow()
})
