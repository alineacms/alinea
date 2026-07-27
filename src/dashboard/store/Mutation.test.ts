import {expect, test} from 'bun:test'
import {createMutationQueueState} from './Mutation.js'

test('summarizes mutation queue state without a store instance', () => {
  const state = createMutationQueueState([
    {status: 'pending'},
    {status: 'syncing'},
    {status: 'failed', error: 'Broken'},
    {status: 'blocked'}
  ] as Parameters<typeof createMutationQueueState>[0])

  expect(state.pending).toBe(1)
  expect(state.syncing).toBe(1)
  expect(state.failed).toBe(1)
  expect(state.blocked).toBe(1)
  expect(state.error).toBe('Broken')
})
