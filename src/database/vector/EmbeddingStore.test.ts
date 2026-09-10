import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {sql} from 'rado'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EmbeddingStore} from './EmbeddingStore.js'
import {
  encodeEmbedding,
  decodeEmbedding,
  type EmbeddingTarget
} from './Embedding.js'

function target(
  kind: EmbeddingTarget['owner']['kind'] = 'entry'
): EmbeddingTarget {
  return {
    owner: {versionId: 'entry/en/published', kind},
    slot: 'semantic',
    chunk: 'paragraph-1',
    sourceHash: 'a'.repeat(40),
    space: {
      provider: 'fixture',
      model: 'model',
      revision: 'v1',
      preprocessing: 'text-v1',
      dimensions: 3,
      metric: 'cosine',
      encoding: 'float32-le'
    }
  }
}

for (const driver of ['native', 'wasm'] as const) {
  test(`${driver} embedding jobs persist separately from lazy vector bytes`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      for (const kind of ['entry', 'image', 'document'] as const) {
        const input = target(kind)
        const job = await store.schedule(input)
        const pending = await store.revision()
        expect(await store.load(job)).toBeUndefined()
        expect(await store.manifest(job.id)).toMatchObject({
          ...job,
          payloadId: null
        })
        expect(await store.schedule(input)).toEqual(job)
        expect(await store.revision()).toBe(pending)
        expect(await store.install(job, [1, 2, 3])).toBe(true)
        const completed = await store.revision()
        expect(completed).not.toBe(pending)
        expect((await store.manifest(job.id))?.target.sourceHash).toBe(
          input.sourceHash
        )
        expect(await store.install(job, [1, 2, 3])).toBe(false)
        expect(await store.revision()).toBe(completed)
        await expect(store.install(job, [3, 2, 1])).rejects.toThrow(
          'different bytes'
        )
        const reopened = new EmbeddingStore(db)
        expect(await reopened.load(job)).toEqual([1, 2, 3])
        const values = await reopened.load(job)
        values![0] = 9
        expect(await reopened.load(job)).toEqual([1, 2, 3])
      }
      const job = await store.schedule(target())
      await db.execute(sql`DROP TABLE alinea_embedding_data`)
      // This read still works with the vector table absent.
      expect((await store.manifest(job.id))?.payloadId).toHaveLength(64)
    } finally {
      db.close()
    }
  })

  test(`${driver} rejects stale source/model jobs and removed owner chunks`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const input = target()
      const old = await store.schedule(input)
      input.sourceHash = 'b'.repeat(40)
      const next = await store.schedule(input)
      expect(next.id).toBe(old.id)
      expect(next.generation).not.toBe(old.generation)
      await expect(store.install(old, [1, 2, 3])).rejects.toThrow('Obsolete')
      await expect(store.load(old)).rejects.toThrow('Obsolete')
      const again = await store.schedule(target())
      await expect(store.install(old, [1, 2, 3])).rejects.toThrow('Obsolete')
      expect(await store.install(again, [1, 2, 3])).toBe(true)
      const model = await store.schedule({
        ...target(),
        space: {...target().space, revision: 'v2'}
      })
      expect(model.spaceId).not.toBe(again.spaceId)
      expect(await store.load(model)).toBeUndefined()
      await expect(store.install(again, [1, 2, 3])).rejects.toThrow('Obsolete')
      await expect(
        store.install({...model, spaceId: again.spaceId}, [1, 2, 3])
      ).rejects.toThrow('Obsolete')
      await store.remove(model.id)
      expect(await store.manifest(model.id)).toBeUndefined()
      await expect(store.install(model, [1, 2, 3])).rejects.toThrow('Obsolete')
      const removed = await store.revision()
      await store.remove(model.id)
      expect(await store.revision()).toBe(removed)
    } finally {
      db.close()
    }
  })
}

test('float32 vector encoding rejects incompatible, nonfinite and zero cosine values', () => {
  const {space} = target()
  expect(Array.from(encodeEmbedding(space, [1, -2, 0]))).toEqual([
    0, 0, 128, 63, 0, 0, 0, 192, 0, 0, 0, 0
  ])
  expect(decodeEmbedding(space, encodeEmbedding(space, [1, -2, 0]))).toEqual([
    1, -2, 0
  ])
  for (const vector of [
    [1],
    [1, Infinity, 2],
    [1, NaN, 2],
    [1e300, 2, 3],
    [0, 0, 0]
  ])
    expect(() => encodeEmbedding(space, vector)).toThrow()
  expect(() => decodeEmbedding(space, new Uint8Array(4))).toThrow('byte length')
  expect(() =>
    encodeEmbedding({...space, encoding: 'other' as 'float32-le'}, [1, 2, 3])
  ).toThrow('Unsupported')
  expect(() =>
    decodeEmbedding({...space, dimensions: 65537}, new Uint8Array(0))
  ).toThrow('Unsupported')
})

test('native embedding checkpoint reopens in WASM and authenticates vector bytes', async () => {
  const native = new Database(':memory:')
  const db = connect(native)
  await EmbeddingStore.createSchema(db)
  const store = new EmbeddingStore(db)
  const job = await store.schedule(target('document'))
  await store.install(job, [1, 2, 3])
  const checkpoint = native.serialize()
  db.close()
  const wasm = await wasmDatabase(checkpoint)
  try {
    const reopened = new EmbeddingStore(wasm)
    expect(await reopened.load(job)).toEqual([1, 2, 3])
    await wasm.execute(
      sql`UPDATE alinea_embedding_data SET bytes = ${new Uint8Array(12)}`
    )
    await expect(reopened.load(job)).rejects.toThrow(
      'Corrupt embedding payload'
    )
  } finally {
    wasm.close()
  }
})
