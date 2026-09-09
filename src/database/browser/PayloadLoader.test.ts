import {expect, test} from 'bun:test'
import {IDBFactory} from 'fake-indexeddb'
import {Permission} from '#/core/Role.js'
import {Entry} from '#/core/Entry.js'
import {config, entry, Page} from '#test/sqlite-browser/config.js'
import {entryVersionId} from '../entry/Schema.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import {createFrameKey, encryptFrame} from '../replica/Frame.js'
import {ReplicaCache, type ReplicaIdentity} from './ReplicaCache.js'
import {PayloadLoader} from './PayloadLoader.js'

const identity: ReplicaIdentity = {
  project: 'project',
  namespace: 'main',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release',
  principal: 'user',
  viewId: 'view'
}
const request = {
  versionId: entryVersionId('a', null, 'published'),
  payloadId: 'payload'
}
const payload = {
  data: {title: 'Encrypted title'},
  source: {filePath: 'content/a.json'}
}
const row = {
  entry: entry('a'),
  payloadId: request.payloadId,
  permissions: Permission.All,
  fields: {title: Permission.All}
}

async function fixture() {
  const cache = await ReplicaCache.open(new IDBFactory(), identity)
  await cache.apply({fromRevision: undefined, toRevision: 'r1', entries: [row]})
  const key = createFrameKey()
  const frame = await encryptFrame(
    {...identity, ...request, kind: 'data'},
    new TextEncoder().encode(JSON.stringify(payload)),
    key
  )
  const options = {
    identity,
    revision: 'r1',
    grants: [{descriptor: frame.descriptor, key}],
    cache
  }
  return {cache, frame, options}
}

test('SQL hydration decrypts only selected data, deduplicates reads and restores ciphertext without network', async () => {
  const {cache, frame, options} = await fixture()
  let reads = 0
  const loader = new PayloadLoader({
    ...options,
    async read() {
      reads++
      return frame.ciphertext
    }
  })
  const db = await wasmDatabase()
  try {
    await EntryRuntime.createSchema(db, 'empty')
    const runtime = new EntryRuntime(config, db, {
      load: requests => loader.load(requests)
    })
    await runtime.apply({
      fromRevision: 'empty',
      toRevision: 'r1',
      entries: [row]
    })
    expect(await runtime.find({select: Entry.id})).toEqual(['a'])
    expect(reads).toBe(0)
    const values = await Promise.all([
      runtime.find({select: Page.title}),
      runtime.find({select: Page.title})
    ])
    expect(values).toEqual([['Encrypted title'], ['Encrypted title']])
    expect(reads).toBe(1)
    expect(await runtime.find({select: Entry.filePath})).toEqual([
      'content/a.json'
    ])
    expect((await cache.getFrames([request]))[0].ciphertext).toEqual(
      frame.ciphertext
    )
    loader.close()
    const restored = new PayloadLoader({
      ...options,
      async read() {
        throw new Error('Unexpected network read')
      }
    })
    try {
      expect(await restored.load([request])).toEqual([{...request, ...payload}])
    } finally {
      restored.close()
    }
  } finally {
    loader.close()
    cache.close()
    db.close()
  }
})

test('loader preflights every grant and repairs tampered cached ciphertext from its source', async () => {
  const {cache, frame, options} = await fixture()
  let reads = 0
  const loader = new PayloadLoader({
    ...options,
    async read() {
      reads++
      return frame.ciphertext
    }
  })
  try {
    await expect(
      loader.load([request, {...request, payloadId: 'wrong'}])
    ).rejects.toThrow('grant')
    expect(reads).toBe(0)
    expect(
      () =>
        new PayloadLoader({
          ...options,
          identity: {...identity, principal: 'other'},
          read: async () => frame.ciphertext
        })
    ).toThrow('cache identity')
    expect(
      () =>
        new PayloadLoader({
          ...options,
          grants: [
            {
              ...options.grants[0],
              descriptor: {...frame.descriptor, namespace: 'other'}
            }
          ],
          read: async () => frame.ciphertext
        })
    ).toThrow('identity mismatch')
    const corrupt = frame.ciphertext.slice()
    corrupt[0] ^= 1
    await cache.putFrames('r1', [{...request, ciphertext: corrupt}])
    expect(await loader.load([request])).toEqual([{...request, ...payload}])
    expect(reads).toBe(1)
    expect((await cache.getFrames([request]))[0].ciphertext).toEqual(
      frame.ciphertext
    )
  } finally {
    loader.close()
    cache.close()
  }
})

test('revoked in-flight grants cannot return plaintext or repopulate ciphertext', async () => {
  const {cache, frame, options} = await fixture()
  const started = Promise.withResolvers<void>()
  const response = Promise.withResolvers<Uint8Array>()
  const loader = new PayloadLoader({
    ...options,
    read() {
      started.resolve()
      return response.promise
    }
  })
  try {
    const pending = loader.load([request])
    const outcome = pending.then(
      () => undefined,
      error => error
    )
    await started.promise
    loader.close()
    response.resolve(frame.ciphertext)
    expect(await outcome).toMatchObject({message: 'Payload grants revoked'})
    expect(await cache.getFrames([request])).toEqual([])
    await expect(loader.load([request])).rejects.toThrow('revoked')
  } finally {
    loader.close()
    cache.close()
  }
})

test('a revision change during download prevents stale frame installation', async () => {
  const {cache, frame, options} = await fixture()
  const started = Promise.withResolvers<void>()
  const response = Promise.withResolvers<Uint8Array>()
  const loader = new PayloadLoader({
    ...options,
    read() {
      started.resolve()
      return response.promise
    }
  })
  try {
    const pending = loader.load([request])
    const outcome = pending.then(
      () => undefined,
      error => error
    )
    await started.promise
    await cache.apply({
      fromRevision: 'r1',
      toRevision: 'r2',
      entries: [{...row, payloadId: 'new'}]
    })
    response.resolve(frame.ciphertext)
    expect(await outcome).toMatchObject({
      message: 'Stale replica payload response'
    })
    expect(await cache.getFrames([request])).toEqual([])
  } finally {
    loader.close()
    cache.close()
  }
})
