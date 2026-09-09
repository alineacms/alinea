import {expect, test} from 'bun:test'
import {createId, timestampFromId} from './Id.js'

test('reads the creation timestamp embedded in an entry id', () => {
  const before = Date.now() - 1000
  const timestamp = timestampFromId(createId())
  const after = Date.now() + 1000

  expect(timestamp).toBeGreaterThanOrEqual(before)
  expect(timestamp).toBeLessThanOrEqual(after)
})

test('does not return a timestamp for an invalid entry id', () => {
  expect(timestampFromId('not-an-entry-id')).toBeUndefined()
})
