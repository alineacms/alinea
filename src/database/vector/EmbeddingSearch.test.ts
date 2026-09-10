import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {sql} from 'rado'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EmbeddingStore} from './EmbeddingStore.js'
import type {
  EmbeddingSpace,
  EmbeddingTarget,
  EmbeddingJob
} from './Embedding.js'
import {embeddingDistance} from './EmbeddingSearch.js'

const space: EmbeddingSpace = {
  provider: 'fixture',
  model: 'model',
  revision: 'v1',
  preprocessing: 'text',
  dimensions: 2,
  metric: 'cosine',
  encoding: 'float32-le'
}
function target(id: string, selected = space): EmbeddingTarget {
  return {
    owner: {versionId: id, kind: 'entry'},
    ownerPayloadId: 'owner-v1',
    slot: 'semantic',
    chunk: 'main',
    sourceHash: 'a'.repeat(40),
    space: selected
  }
}

test('exact distances use cosine, Euclidean L2 and negative dot product', () => {
  expect(embeddingDistance('cosine', [1, 0], [1, 0])).toBe(0)
  expect(embeddingDistance('cosine', [1, 0], [0, 1])).toBe(1)
  expect(embeddingDistance('cosine', [1, 0], [-1, 0])).toBe(2)
  expect(embeddingDistance('l2', [1, 2], [4, 6])).toBe(5)
  expect(embeddingDistance('dot', [1, 2], [4, 6])).toBe(-16)
  expect(() => embeddingDistance('cosine', [0, 0], [1, 0])).toThrow('nonzero')
  expect(() => embeddingDistance('l2', [1], [1, 0])).toThrow('dimension')
  expect(() => embeddingDistance('dot', [NaN], [1])).toThrow('Nonfinite')
})

for (const driver of ['native', 'wasm'] as const) {
  test(`${driver} includes candidates beyond the first SQL batch in exact top-k`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const ids: Array<string> = []
      for (let i = 0; i < 129; i++) {
        const job = await store.schedule(target(`entry-${i}`))
        await store.install(job, [i + 1, 129 - i])
        ids.push(job.id)
      }
      const result = await store.search({
        revision: await store.revision(),
        space,
        vector: [1, 0],
        candidateIds: ids,
        limit: 5
      })
      expect(result.candidates).toBe(129)
      expect(result.matches.map(match => match.owner.versionId)).toEqual([
        'entry-128',
        'entry-127',
        'entry-126',
        'entry-125',
        'entry-124'
      ])
      expect(result.matches[0].distance).toBeCloseTo(
        1 - 129 / Math.sqrt(129 ** 2 + 1),
        12
      )
    } finally {
      db.close()
    }
  })

  test(`${driver} ranks exactly inside a revision-bound candidate scope`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      for (const metric of ['cosine', 'l2', 'dot'] as const) {
        const selected = {...space, metric}
        const rows = [
          {name: 'first', vector: [1, 0]},
          {name: 'tie', vector: [1, 0]},
          {name: 'second', vector: [1, 1]},
          {name: 'last', vector: [-1, 0]}
        ]
        const jobs: Array<EmbeddingJob> = []
        for (const row of rows) {
          const job = await store.schedule(
            target(`${metric}/${row.name}`, selected)
          )
          await store.install(job, row.vector)
          jobs.push(job)
        }
        const query = {
          revision: await store.revision(),
          space: selected,
          vector: [1, 0],
          candidateIds: jobs.map(job => job.id),
          limit: 3
        }
        const result = await store.search(query)
        const oracle = jobs
          .map((job, i) => ({
            id: job.id,
            distance: embeddingDistance(metric, query.vector, rows[i].vector)
          }))
          .sort(
            (a, b) =>
              a.distance - b.distance ||
              (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
          )
        expect(
          result.matches.map(({id, distance}) => ({id, distance}))
        ).toEqual(oracle.slice(0, 3))
        const mutable = {
          ...query,
          vector: [...query.vector],
          candidateIds: [...query.candidateIds]
        }
        const running = store.search(mutable)
        mutable.vector[0] = -1
        mutable.candidateIds.length = 0
        expect((await running).matches).toEqual(result.matches)
        expect(result).toMatchObject({
          revision: query.revision,
          scope: 'provided-candidates',
          candidates: 4,
          exact: true
        })
        const restricted = await store.search({
          ...query,
          candidateIds: [jobs[2].id, jobs[3].id],
          limit: 1
        })
        expect(restricted.matches[0].id).toBe(jobs[2].id)
        expect(restricted.candidates).toBe(2)
        expect(
          (await store.search({...query, candidateIds: []})).matches
        ).toEqual([])
        await expect(
          store.search({...query, space: {...selected, revision: 'other'}})
        ).rejects.toThrow('space mismatch')
        await expect(
          store.search({...query, candidateIds: ['f'.repeat(64)]})
        ).rejects.toThrow('missing candidates')
        expect(() =>
          store.search({...query, candidateIds: [jobs[0].id, jobs[0].id]})
        ).toThrow('Invalid')
        const pending = await store.schedule(
          target(`${metric}/pending`, selected)
        )
        await expect(store.search(query)).rejects.toThrow('scope is stale')
        await expect(
          store.search({
            ...query,
            revision: await store.revision(),
            candidateIds: [jobs[0].id, pending.id]
          })
        ).rejects.toThrow('not fully embedded')
      }
    } finally {
      db.close()
    }
  })

  test(`${driver} rejects corrupt or oversized payloads rather than returning partial rankings`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const job = await store.schedule(target('entry'))
      await store.install(job, [1, 0])
      const query = {
        revision: await store.revision(),
        space,
        vector: [1, 0],
        candidateIds: [job.id],
        limit: 1
      }
      await db.execute(
        sql`UPDATE alinea_embedding_data SET bytes = ${new Uint8Array(12)}`
      )
      await expect(store.search(query)).rejects.toThrow('Corrupt')
      await db.execute(
        sql`UPDATE alinea_embedding_data SET bytes = ${new Uint8Array(8)}`
      )
      await expect(store.search(query)).rejects.toThrow('Corrupt')
      expect(() =>
        store.search({...query, candidateIds: Array(1025).fill(job.id)})
      ).toThrow('work limit')
      expect(() =>
        store.search({
          ...query,
          space: {...space, dimensions: 65536},
          vector: Array(65536).fill(1),
          candidateIds: Array(17).fill(job.id)
        })
      ).toThrow('work limit')
    } finally {
      db.close()
    }
  })
}
