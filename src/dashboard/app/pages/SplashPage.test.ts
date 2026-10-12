import {expect, test} from 'bun:test'
import {recentChange} from './SplashPage.js'

const alice = {name: 'Alice', email: 'alice@example.com'}
const bob = {name: '', email: 'bob@example.com'}
const unknown = {name: '', email: ''}

test('a recent change is a creation or an edit, by whom and when', () => {
  const cases = [
    // A creation that was not updated since is the creation
    [[100, alice, 100, alice], 'Created', 'Alice', 100_000],
    [[100, alice, null, null], 'Created', 'Alice', 100_000],
    // An unknown creator falls back to who updated the entry
    [[100, unknown, 100, alice], 'Created', 'Alice', 100_000],
    // An update after the creation is an edit by the last editor
    [[100, alice, 200, bob], 'Edited', 'bob@example.com', 200_000],
    [[null, null, 200, alice], 'Edited', 'Alice', 200_000]
  ] as const
  for (const [
    [createdAt, createdBy, updatedAt, updatedBy],
    action,
    actor,
    changedAt
  ] of cases)
    expect(recentChange({createdAt, createdBy, updatedAt, updatedBy})).toEqual({
      action,
      actor,
      changedAt
    })
  // Without audit timestamps there is no action or time
  expect(
    recentChange({
      createdAt: null,
      createdBy: null,
      updatedAt: null,
      updatedBy: null
    })
  ).toEqual({actor: undefined})
})
