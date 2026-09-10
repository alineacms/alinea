import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {sql} from 'rado'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import type {EmbeddingPublication} from './Embedding.js'
import {EmbeddingStore} from './EmbeddingStore.js'

const owner: Omit<EmbeddingPublication, 'chunks'> = {
  owner: {versionId: 'document', kind: 'document'},
  ownerPayloadId: 'owner-v1',
  slot: 'semantic',
  space: {
    provider: 'fixture',
    model: 'model',
    revision: '1',
    preprocessing: 'text-v1',
    dimensions: 2,
    metric: 'cosine',
    encoding: 'float32-le'
  }
}
const chunks = ['first', 'second'].map(chunk => ({
  chunk,
  sourceHash: 'a'.repeat(40)
}))

for (const driver of ['native', 'wasm'] as const) {
  test(`${driver} detaches publication input and rejects competing stale preparations`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const input = structuredClone({...owner, chunks})
      const pending = store.publishOwner(input, await store.revision())
      input.ownerPayloadId = 'changed'
      input.chunks[0].sourceHash = 'b'.repeat(40)
      const jobs = await pending
      expect(
        jobs.every(job => job.target.ownerPayloadId === owner.ownerPayloadId)
      ).toBe(true)
      expect(jobs.every(job => job.target.sourceHash === 'a'.repeat(40))).toBe(
        true
      )
      const revision = await store.revision()
      const results = await Promise.allSettled([
        store.publishOwner({...owner, chunks: [chunks[0]]}, revision),
        store.publishOwner({...owner, chunks: [chunks[1]]}, revision)
      ])
      expect(results.map(result => result.status)).toEqual([
        'fulfilled',
        'rejected'
      ])
      const ids = await store.candidates(
        await store.revision(),
        [{versionId: owner.owner.versionId, payloadId: owner.ownerPayloadId}],
        owner.space,
        owner.slot
      )
      expect(ids).toHaveLength(1)
      expect((await store.manifest(ids[0]))?.target.chunk).toBe(chunks[0].chunk)
    } finally {
      db.close()
    }
  })

  test(`${driver} publishes complete owner chunks, preserves ready jobs and distinguishes empty from unknown`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const candidates = () =>
        store.revision().then(revision =>
          store.candidates(
            revision,
            [
              {
                versionId: owner.owner.versionId,
                payloadId: owner.ownerPayloadId
              }
            ],
            owner.space,
            owner.slot
          )
        )
      const initial = await store.revision()
      await expect(candidates()).rejects.toThrow('not fully indexed')
      const jobs = await store.publishOwner({...owner, chunks}, initial)
      expect(jobs).toHaveLength(2)
      expect(await candidates()).toHaveLength(2)
      const published = await store.revision()
      expect(
        await store.publishOwner(
          {...owner, chunks: [...chunks].reverse()},
          published
        )
      ).toEqual(jobs)
      expect(await store.revision()).toBe(published)
      await expect(
        store.publishOwner({...owner, chunks: []}, initial)
      ).rejects.toThrow('revision is stale')
      await store.install(jobs[0], [1, 0])
      await expect(
        store.search({
          revision: await store.revision(),
          candidateIds: await candidates(),
          space: owner.space,
          vector: [1, 0],
          limit: 1
        })
      ).rejects.toThrow('not fully embedded')
      await store.install(jobs[1], [0, 1])
      const ready = await store.revision()
      expect(await store.publishOwner({...owner, chunks}, ready)).toEqual(jobs)
      expect(await store.revision()).toBe(ready)
      const retained = jobs[0]
      const replaced = await store.publishOwner(
        {
          ...owner,
          chunks: [
            {
              chunk: retained.target.chunk,
              sourceHash: retained.target.sourceHash
            },
            {chunk: 'third', sourceHash: 'b'.repeat(40)}
          ]
        },
        ready
      )
      expect(replaced.find(job => job.id === retained.id)).toEqual(retained)
      expect(await store.load(retained)).toEqual([1, 0])
      await expect(store.install(jobs[1], [0, 1])).rejects.toThrow('Obsolete')
      await store.publishOwner({...owner, chunks: []}, await store.revision())
      expect(await candidates()).toEqual([])
      await expect(store.install(retained, [1, 0])).rejects.toThrow('Obsolete')
      const restored = await store.publishOwner(
        {...owner, chunks},
        await store.revision()
      )
      expect(restored.find(job => job.id === retained.id)?.generation).not.toBe(
        retained.generation
      )
      // Standalone low-level changes revoke the complete-owner declaration.
      await store.schedule({
        ...owner,
        chunk: 'unregistered',
        sourceHash: 'c'.repeat(40)
      })
      await expect(candidates()).rejects.toThrow('not fully indexed')
      await store.publishOwner({...owner, chunks}, await store.revision())
      expect(await candidates()).toHaveLength(2)
      await store.remove(restored[0].id)
      await expect(candidates()).rejects.toThrow('not fully indexed')
    } finally {
      db.close()
    }
  })

  test(`${driver} rolls back the entire chunk replacement if publication fails`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const jobs = await store.publishOwner(
        {...owner, chunks},
        await store.revision()
      )
      const revision = await store.revision()
      await db.execute(
        sql`CREATE TRIGGER fail_publication BEFORE INSERT ON alinea_embedding_publication BEGIN SELECT RAISE(ABORT, 'publication failed'); END`
      )
      await expect(
        store.publishOwner(
          {
            ...owner,
            chunks: [{chunk: 'replacement', sourceHash: 'b'.repeat(40)}]
          },
          revision
        )
      ).rejects.toThrow('publication failed')
      expect(await store.revision()).toBe(revision)
      for (const job of jobs)
        expect(await store.manifest(job.id)).toMatchObject(job)
      expect(
        await store.candidates(
          revision,
          [{versionId: owner.owner.versionId, payloadId: owner.ownerPayloadId}],
          owner.space,
          owner.slot
        )
      ).toHaveLength(2)
      expect(() =>
        store.publishOwner({...owner, chunks: [chunks[0], chunks[0]]}, revision)
      ).toThrow('Duplicate')
    } finally {
      db.close()
    }
  })
}
