import {expect, test} from 'bun:test'
import type {DevDB} from './DevDB.js'
import {fillCache} from './FillCache.js'

function mockDB(sync: () => Promise<void>): DevDB {
  return {
    sync,
    async fix() {},
    async watchFiles() {
      return {files: [], dirs: []}
    }
  } as unknown as DevDB
}

test('completes a cache fill when not watching', async () => {
  const db = mockDB(async () => {})
  const iterator = fillCache(db, false, false)[Symbol.asyncIterator]()

  expect(await iterator.next()).toEqual({value: db, done: false})
  expect(await iterator.next()).toEqual({value: undefined, done: true})
})

test('throws a cache fill error when not watching', async () => {
  const error = new Error('duplicate id')
  const iterator = fillCache(
    mockDB(async () => {
      throw error
    }),
    false,
    false
  )[Symbol.asyncIterator]()

  expect(iterator.next()).rejects.toBe(error)
})
