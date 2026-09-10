import {expect, spyOn, test} from 'bun:test'
import {crypto} from '@alinea/iso'
import {IDBFactory} from 'fake-indexeddb'
import {
  PendingMutations,
  type PendingMutationInput,
  type PendingScope
} from './PendingMutations.js'
import {idbResult} from './IndexedDB.js'

const scope: PendingScope = {
  project: 'project',
  namespace: 'preview',
  epoch: '1',
  principal: 'user',
  endpoint: 'https://cms.test/api'
}
const input: PendingMutationInput = {
  id: 'id',
  baseRevision: 'base',
  schemaId: 'schema',
  configId: 'config',
  mutations: [
    {
      op: 'update',
      id: 'entry',
      locale: null,
      status: 'draft',
      set: {title: 'Private draft title'}
    }
  ]
}

test('pending edits retain IDs, ordering, schema context and acceptance after reopen', async () => {
  const factory = new IDBFactory()
  const first = await PendingMutations.open(factory, scope)
  const mutable = structuredClone(input)
  const enqueue = first.enqueue(mutable)
  mutable.mutations.length = 0
  const queued = await enqueue
  await first.enqueue({...input, id: 'second'})
  await first.accept(queued.id, queued.digest, 'accepted')
  first.close()
  const reopened = await PendingMutations.open(factory, scope)
  const rows = await reopened.list()
  expect(rows.map(row => row.id)).toEqual(['id', 'second'])
  expect(rows[0]).toMatchObject({...input, acceptedSha: 'accepted', order: 1})
  expect((await reopened.enqueue(input)).acceptedSha).toBe('accepted')
  await expect(
    reopened.enqueue({...input, baseRevision: 'new-base'})
  ).rejects.toThrow('already used')
  await expect(reopened.enqueue({...input, mutations: []})).rejects.toThrow(
    'Invalid pending mutation'
  )
  await expect(
    reopened.accept(queued.id, queued.digest, 'different')
  ).rejects.toThrow('another revision')
  await expect(reopened.remove(queued.id, 'wrong')).rejects.toThrow(
    'does not match'
  )
  await reopened.remove(queued.id, queued.digest)
  expect((await reopened.list()).map(row => row.id)).toEqual(['second'])
  await reopened.purge()
})

test('pending scope partitions users, branches, source resets and endpoints, not releases', async () => {
  const factory = new IDBFactory()
  const store = await PendingMutations.open(factory, scope)
  await store.enqueue(input)
  for (const field of [
    'project',
    'namespace',
    'epoch',
    'principal',
    'endpoint'
  ] as const) {
    const other = await PendingMutations.open(factory, {
      ...scope,
      [field]: field === 'endpoint' ? 'https://cms.test/other' : 'different'
    })
    expect(await other.list()).toEqual([])
    await other.purge()
  }
  const same = await PendingMutations.open(factory, scope)
  expect((await same.list())[0]).toMatchObject({
    schemaId: 'schema',
    configId: 'config'
  })
  await same.purge()
  await expect(store.list()).rejects.toThrow('invalidated')
  await expect(store.enqueue({...input, id: 'late'})).rejects.toThrow(
    'invalidated'
  )
  store.close()
  const fresh = await PendingMutations.open(factory, scope)
  expect(await fresh.list()).toEqual([])
  await fresh.purge()
})

test('concurrent owners converge on one stored intent and conflicting reuse cannot overwrite it', async () => {
  const factory = new IDBFactory()
  const [a, b] = await Promise.all([
    PendingMutations.open(factory, scope),
    PendingMutations.open(factory, scope)
  ])
  const rows = await Promise.all([a.enqueue(input), b.enqueue(input)])
  expect(rows[0]).toEqual(rows[1])
  await expect(b.enqueue({...input, schemaId: 'other-schema'})).rejects.toThrow(
    'already used'
  )
  await Promise.all(
    rows.map((row, index) =>
      [a, b][index].accept(row.id, row.digest, 'accepted')
    )
  )
  expect((await a.list())[0].acceptedSha).toBe('accepted')
  await a.purge()
  b.close()
})

test('IndexedDB contains encrypted values and a non-extractable device key', async () => {
  const factory = new IDBFactory()
  const store = await PendingMutations.open(factory, scope)
  const queued = await store.enqueue(input)
  await store.accept(queued.id, queued.digest, 'accepted-secret')
  const [{name}] = await factory.databases()
  const db = await idbResult(factory.open(name!))
  const tx = db.transaction(['state', 'mutations'], 'readonly')
  const state = await idbResult<{key: CryptoKey}>(
    tx.objectStore('state').get('current')
  )
  const row = await idbResult<{
    body: {ciphertext: ArrayBuffer}
    acceptance: {ciphertext: ArrayBuffer}
  }>(tx.objectStore('mutations').get('id'))
  expect(state.key.extractable).toBe(false)
  await expect(crypto.subtle.exportKey('raw', state.key)).rejects.toThrow()
  expect(new TextDecoder().decode(row.body.ciphertext)).not.toContain(
    'Private draft title'
  )
  expect(new TextDecoder().decode(row.acceptance.ciphertext)).not.toContain(
    'accepted-secret'
  )
  db.close()
  await store.purge()
})

test('logout while decryption is pending cannot return the old draft', async () => {
  const factory = new IDBFactory()
  const store = await PendingMutations.open(factory, scope)
  await store.enqueue(input)
  const started = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const original = crypto.subtle.decrypt.bind(crypto.subtle)
  using decrypt = spyOn(crypto.subtle, 'decrypt').mockImplementation(
    async (...args) => {
      started.resolve()
      await resume.promise
      return original(...args)
    }
  )
  const pending = store.list()
  await started.promise
  await store.purge()
  resume.resolve()
  await expect(pending).rejects.toThrow('closed')
})

test('swapping encrypted intent bodies cannot change their bound transaction IDs', async () => {
  const factory = new IDBFactory()
  const store = await PendingMutations.open(factory, scope)
  await store.enqueue(input)
  await store.enqueue({...input, id: 'second'})
  const [{name}] = await factory.databases()
  const db = await idbResult(factory.open(name!))
  const tx = db.transaction('mutations', 'readwrite')
  const records = tx.objectStore('mutations')
  const first = await idbResult<{body: unknown}>(records.get('id'))
  const second = await idbResult<{body: unknown}>(records.get('second'))
  await idbResult(records.put({...second, body: first.body}, 'second'))
  await expect(store.list()).rejects.toThrow()
  db.close()
  await store.purge()
})

test('a full pending queue rejects atomically and removing an item makes room', async () => {
  const factory = new IDBFactory()
  const store = await PendingMutations.open(factory, scope)
  for (let index = 0; index < 128; index++)
    await store.enqueue({...input, id: String(index)})
  await expect(store.enqueue({...input, id: 'overflow'})).rejects.toThrow(
    'queue is full'
  )
  const rows = await store.list()
  expect(rows).toHaveLength(128)
  await store.remove(rows[0].id, rows[0].digest)
  expect((await store.enqueue({...input, id: 'new'})).order).toBe(129)
  await store.purge()
})
