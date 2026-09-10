import {expect, spyOn, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import pLimit from 'p-limit'
import {
  MutationQueue,
  type MutationQueueLock,
  type MutationQueueOptions
} from './MutationQueue.js'
import {
  PendingMutations,
  type PendingMutationInput
} from './PendingMutations.js'

const scope = {
  project: 'project',
  namespace: 'preview',
  epoch: '1',
  principal: 'user',
  endpoint: 'https://cms.test/api'
}
const input: PendingMutationInput = {
  id: 'edit',
  baseRevision: 'base',
  schemaId: 'schema',
  configId: 'config',
  mutations: [
    {
      op: 'update',
      id: 'entry',
      locale: null,
      status: 'draft',
      set: {title: 'Edited'}
    }
  ]
}

async function setup() {
  const factory = new IDBFactory()
  const serial = pLimit(1)
  const lock: MutationQueueLock = (_name, run, signal) =>
    serial(() => {
      signal.throwIfAborted()
      return run()
    })
  const replica = {
    identity: {
      ...scope,
      schemaId: 'new-schema',
      configId: 'new-config',
      viewId: 'view',
      releaseId: 'release'
    },
    refreshAfterWrite: async () => true
  }
  const calls: Array<Parameters<MutationQueueOptions['client']['mutate']>> = []
  const client: MutationQueueOptions['client'] = {
    async mutate(...args) {
      calls.push(args)
      return {sha: 'accepted'}
    }
  }
  async function open() {
    const store = await PendingMutations.open(factory, scope)
    return {
      store,
      queue: new MutationQueue({scope, store, replica, client, lock})
    }
  }
  return {factory, replica, client, calls, open, ...(await open())}
}

test('queue restores without sending and preserves captured context after a lost response', async () => {
  const state = await setup()
  await state.queue.enqueue(input)
  const mutate = state.client.mutate
  state.client.mutate = async (...args) => {
    await mutate(...args)
    throw new Error('Lost response')
  }
  await expect(state.queue.flush()).rejects.toThrow('Lost response')
  await state.queue.close()
  const reopened = await state.open()
  expect(state.calls).toHaveLength(1)
  state.client.mutate = mutate
  await reopened.queue.flush()
  expect(state.calls).toHaveLength(2)
  expect(state.calls[0].slice(0, 3)).toEqual(state.calls[1].slice(0, 3))
  expect(state.calls[1][2]).toEqual({
    project: scope.project,
    namespace: scope.namespace,
    epoch: scope.epoch,
    principal: scope.principal,
    schemaId: input.schemaId,
    configId: input.configId,
    baseRevision: input.baseRevision
  })
  expect(await reopened.queue.list()).toEqual([])
  await reopened.queue.close({purge: true})
})

test('accepted edits survive refresh failure and restart without another submission', async () => {
  const state = await setup()
  await state.queue.enqueue(input)
  await state.queue.enqueue({...input, id: 'later'})
  state.replica.refreshAfterWrite = async () => {
    throw new Error('Offline')
  }
  await expect(state.queue.flush()).rejects.toThrow('Offline')
  expect((await state.queue.list())[0].acceptedSha).toBe('accepted')
  expect(state.calls).toHaveLength(1)
  await state.queue.close()
  const reopened = await state.open()
  state.replica.refreshAfterWrite = async () => true
  await reopened.queue.flush()
  expect(state.calls.map(call => call[1])).toEqual(['edit', 'later'])
  await reopened.queue.close({purge: true})
})

test('acceptance persistence failure uses an in-memory receipt on retry', async () => {
  const state = await setup()
  await state.queue.enqueue(input)
  const accept = spyOn(state.store, 'accept').mockRejectedValueOnce(
    new Error('Disk unavailable')
  )
  await expect(state.queue.flush()).rejects.toThrow('Disk unavailable')
  accept.mockRestore()
  await state.queue.flush()
  expect(state.calls).toHaveLength(1)
  await state.queue.close({purge: true})
})

test('two queue owners serialize sending and refresh through a shared lock', async () => {
  const state = await setup()
  const second = await state.open()
  await state.queue.enqueue(input)
  await second.queue.enqueue({...input, id: 'second'})
  await Promise.all([state.queue.flush(), second.queue.flush()])
  expect(state.calls.map(call => call[1])).toEqual(['edit', 'second'])
  await second.queue.close()
  await state.queue.close({purge: true})
})

test('scope changes fail closed without submitting or deleting drafts', async () => {
  const state = await setup()
  await state.queue.enqueue(input)
  state.replica.identity.principal = 'other'
  await expect(state.queue.flush()).rejects.toThrow('scope changed')
  expect(state.calls).toHaveLength(0)
  expect(await state.store.list()).toHaveLength(1)
  await state.queue.close({purge: true})
})

test('discard waits for authoritative refresh and never submits', async () => {
  const state = await setup()
  await state.queue.enqueue(input)
  state.replica.refreshAfterWrite = async () => {
    throw new Error('Offline')
  }
  await expect(state.queue.discard(input.id)).rejects.toThrow('Offline')
  expect(await state.queue.list()).toHaveLength(1)
  state.replica.refreshAfterWrite = async () => true
  await state.queue.discard(input.id)
  expect(await state.queue.list()).toHaveLength(0)
  expect(state.calls).toHaveLength(0)
  await state.queue.close({purge: true})
})

test('close aborts active submission while retaining unknown-outcome intent', async () => {
  const state = await setup()
  await state.queue.enqueue(input)
  const started = Promise.withResolvers<void>()
  state.client.mutate = async (_mutations, _id, _context, signal) => {
    started.resolve()
    return new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(signal!.reason), {
        once: true
      })
    })
  }
  const flushed = state.queue.flush()
  const rejected = flushed.catch(error => error)
  await started.promise
  await state.queue.close()
  expect(await rejected).toBeInstanceOf(Error)
  expect((await rejected).message).toContain('closed')
  const reopened = await state.open()
  expect(await reopened.queue.list()).toHaveLength(1)
  await reopened.queue.close({purge: true})
})

test('close during refresh retains acceptance and prevents late intent removal', async () => {
  const state = await setup()
  await state.queue.enqueue(input)
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  state.replica.refreshAfterWrite = async () => {
    started.resolve()
    await resume.promise
    return true
  }
  const flushed = state.queue.flush().catch(error => error)
  await started.promise
  const closing = state.queue.close()
  resume.resolve()
  await closing
  expect(await flushed).toBeInstanceOf(Error)
  const reopened = await state.open()
  expect((await reopened.queue.list())[0].acceptedSha).toBe('accepted')
  expect(state.calls).toHaveLength(1)
  await reopened.queue.close({purge: true})
})
