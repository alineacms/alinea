import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {embeddingHash, type EmbeddingSpace} from './Embedding.js'
import {
  prepareEmbeddingInput,
  maxEmbeddingInputBytes,
  type EmbeddingInput
} from './EmbeddingInput.js'
import {EmbeddingStore} from './EmbeddingStore.js'
import {EmbeddingRunner} from './EmbeddingRunner.js'

const space: EmbeddingSpace = {
  provider: 'fixture',
  model: 'model',
  revision: '1',
  preprocessing: 'text-v1',
  dimensions: 2,
  metric: 'cosine',
  encoding: 'float32-le'
}
function input(value: string): EmbeddingInput {
  return {mediaType: 'text/plain', bytes: new TextEncoder().encode(value)}
}
async function publish(store: EmbeddingStore, count = 3, prefix = 'input') {
  const inputs = new Map(
    Array.from({length: count}, (_, i) => [String(i), input(`${prefix}-${i}`)])
  )
  const chunks = await Promise.all(
    [...inputs].map(async ([chunk, value]) => ({
      chunk,
      sourceHash: (await prepareEmbeddingInput(value)).hash
    }))
  )
  const jobs = await store.publishOwner(
    {
      owner: {versionId: 'entry', kind: 'entry'},
      ownerPayloadId: prefix,
      slot: 'semantic',
      space,
      chunks
    },
    await store.revision()
  )
  return {jobs, inputs}
}

test('provider input hashing binds detached bytes and canonical media type with bounded input', async () => {
  const original = input('text')
  const preparing = prepareEmbeddingInput(original)
  original.bytes.fill(0)
  const prepared = await preparing
  expect(new TextDecoder().decode(prepared.input.bytes)).toBe('text')
  const buffer = Buffer.from('text')
  const preparingBuffer = prepareEmbeddingInput({
    mediaType: 'text/plain',
    bytes: buffer
  })
  buffer.fill(0)
  expect((await preparingBuffer).hash).toBe(prepared.hash)
  expect(new TextDecoder().decode((await preparingBuffer).input.bytes)).toBe(
    'text'
  )
  expect(
    (await prepareEmbeddingInput({...input('text'), mediaType: 'TEXT/PLAIN'}))
      .hash
  ).toBe(prepared.hash)
  expect(
    (
      await prepareEmbeddingInput({
        ...input('text'),
        mediaType: 'application/pdf'
      })
    ).hash
  ).not.toBe(prepared.hash)
  await expect(
    prepareEmbeddingInput({
      mediaType: 'text/plain',
      bytes: new Uint8Array(maxEmbeddingInputBytes + 1)
    })
  ).rejects.toThrow('Invalid')
})

for (const driver of ['native', 'wasm'] as const) {
  test(`${driver} runs only durable published jobs with bounded provider concurrency`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    let runner: EmbeddingRunner | undefined
    const resume = Promise.withResolvers<void>()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const {jobs, inputs} = await publish(store, 4)
      const spaceId = await embeddingHash(space)
      await store.schedule({...jobs[0].target, slot: 'unpublished'})
      const otherSpace = {...space, revision: '2'}
      await store.publishOwner(
        {
          owner: jobs[0].target.owner,
          ownerPayloadId: jobs[0].target.ownerPayloadId,
          slot: 'other-model',
          space: otherSpace,
          chunks: [{chunk: '0', sourceHash: jobs[0].target.sourceHash}]
        },
        await store.revision()
      )
      expect(await store.pending(spaceId)).toHaveLength(4)
      let active = 0,
        maximum = 0,
        calls = 0
      const started = Promise.withResolvers<void>()
      runner = new EmbeddingRunner({
        store,
        concurrency: 2,
        async load(job) {
          return inputs.get(job.target.chunk)
        },
        provider: {
          space,
          async embed() {
            calls++
            active++
            maximum = Math.max(maximum, active)
            if (active === 2) started.resolve()
            await resume.promise
            active--
            return {spaceId, vector: [1, 0]}
          }
        }
      })
      expect(calls).toBe(0)
      const running = runner.run()
      expect(runner.run()).toBe(running)
      await started.promise
      expect(calls).toBe(2)
      resume.resolve()
      expect((await running).map(result => result.status)).toEqual(
        Array(4).fill('installed')
      )
      expect(maximum).toBe(2)
      expect(await store.pending(spaceId)).toEqual([])
      expect(await runner.run()).toEqual([])
      expect(calls).toBe(4)
      expect(await store.pending(await embeddingHash(otherSpace))).toHaveLength(
        1
      )
    } finally {
      resume.resolve()
      await runner?.close()
      db.close()
    }
  })

  test(`${driver} retains failed jobs for explicit retry and ignores changed provider input`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    let runner: EmbeddingRunner | undefined
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const {jobs, inputs} = await publish(store, 1)
      const spaceId = await embeddingHash(space)
      let badInput = true,
        wrongSpace = true,
        calls = 0
      const provider = {
        space,
        async embed() {
          calls++
          return {spaceId: wrongSpace ? 'other' : spaceId, vector: [1, 0]}
        }
      }
      runner = new EmbeddingRunner({
        store,
        provider,
        async load(job) {
          return badInput ? input('changed') : inputs.get(job.target.chunk)
        }
      })
      expect((await runner.run())[0].status).toBe('obsolete')
      expect(calls).toBe(0)
      badInput = false
      expect((await runner.run())[0]).toMatchObject({
        status: 'failed',
        error: {message: 'Embedding provider returned a different model space'}
      })
      expect(await store.load(jobs[0])).toBeUndefined()
      await runner.close()
      wrongSpace = false
      runner = new EmbeddingRunner({
        store: new EmbeddingStore(db),
        provider,
        async load(job) {
          return inputs.get(job.target.chunk)
        }
      })
      expect((await runner.run())[0].status).toBe('installed')
      expect(await store.load(jobs[0])).toEqual([1, 0])
    } finally {
      await runner?.close()
      db.close()
    }
  })

  test(`${driver} discards provider results for a superseded owner generation`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    let runner: EmbeddingRunner | undefined
    const resume = Promise.withResolvers<void>()
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const {inputs} = await publish(store, 1)
      const spaceId = await embeddingHash(space)
      const started = Promise.withResolvers<void>()
      runner = new EmbeddingRunner({
        store,
        async load(job) {
          return inputs.get(job.target.chunk)
        },
        provider: {
          space,
          async embed() {
            started.resolve()
            await resume.promise
            return {spaceId, vector: [1, 0]}
          }
        }
      })
      const running = runner.run()
      await started.promise
      const next = await publish(store, 1, 'new-input')
      resume.resolve()
      expect((await running)[0].status).toBe('obsolete')
      expect(await store.load(next.jobs[0])).toBeUndefined()
    } finally {
      resume.resolve()
      await runner?.close()
      db.close()
    }
  })

  test(`${driver} aborts cooperative providers without starting queued work or losing pending jobs`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    let runner: EmbeddingRunner | undefined
    try {
      await EmbeddingStore.createSchema(db)
      const store = new EmbeddingStore(db)
      const {jobs, inputs} = await publish(store, 3)
      const spaceId = await embeddingHash(space)
      const started = Promise.withResolvers<void>()
      let calls = 0
      runner = new EmbeddingRunner({
        store,
        concurrency: 1,
        async load(job) {
          return inputs.get(job.target.chunk)
        },
        provider: {
          space,
          async embed(_input, signal) {
            calls++
            started.resolve()
            await new Promise<void>((_, reject) =>
              signal.addEventListener('abort', () => reject(signal.reason), {
                once: true
              })
            )
            return {spaceId, vector: [1, 0]}
          }
        }
      })
      const running = runner.run()
      await started.promise
      await runner.close()
      expect(
        (await running).every(result => result.status === 'cancelled')
      ).toBe(true)
      expect(calls).toBe(1)
      expect(await store.pending(spaceId)).toHaveLength(3)
      await expect(runner.run()).rejects.toThrow('closed')
      const abort = new AbortController()
      const installing = store.install(jobs[0], [1, 0], abort.signal)
      abort.abort(new Error('Stop installation'))
      await expect(installing).rejects.toThrow('Stop installation')
      expect(await store.load(jobs[0])).toBeUndefined()
    } finally {
      await runner?.close()
      db.close()
    }
  })
}
