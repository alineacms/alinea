import {expect, test} from 'bun:test'
import {recentChange} from './SplashPage.js'

const alice = {name: 'Alice', email: 'alice@example.com'}
const bob = {name: '', email: 'bob@example.com'}

test('a creation that was not updated since is the creation', () => {
  expect(
    recentChange({
      createdAt: 100,
      createdBy: alice,
      updatedAt: 100,
      updatedBy: alice
    })
  ).toEqual({action: 'Created', actor: 'Alice', changedAt: 100_000})
  expect(
    recentChange({
      createdAt: 100,
      createdBy: alice,
      updatedAt: null,
      updatedBy: null
    })
  ).toEqual({action: 'Created', actor: 'Alice', changedAt: 100_000})
})

test('an update after the creation is an edit by the last editor', () => {
  expect(
    recentChange({
      createdAt: 100,
      createdBy: alice,
      updatedAt: 200,
      updatedBy: bob
    })
  ).toEqual({action: 'Edited', actor: 'bob@example.com', changedAt: 200_000})
})

test('an update without a recorded creation is an edit', () => {
  expect(
    recentChange({
      createdAt: null,
      createdBy: null,
      updatedAt: 200,
      updatedBy: alice
    })
  ).toEqual({action: 'Edited', actor: 'Alice', changedAt: 200_000})
})

test('without audit timestamps there is no action or time', () => {
  expect(
    recentChange({
      createdAt: null,
      createdBy: null,
      updatedAt: null,
      updatedBy: null
    })
  ).toEqual({actor: undefined})
})
