import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {sql} from 'rado'
import {Config, Field} from '#/index.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {entryVersionId} from '../entry/Schema.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {openCheckpoint} from '../runtime/Checkpoint.js'
import {reconcileDatabase} from '../runtime/ReconcileDatabase.js'
import {embeddingHash, type EmbeddingSpace} from './Embedding.js'
import {EmbeddingStore} from './EmbeddingStore.js'
import {EmbeddingRunner} from './EmbeddingRunner.js'
import {loadEntryEmbeddingInput} from './EntryEmbeddings.js'

const space: EmbeddingSpace = {
  provider: 'fixture',
  model: 'text',
  revision: '1',
  preprocessing: 'searchable-v1',
  dimensions: 2,
  metric: 'cosine',
  encoding: 'float32-le'
}
const config = {
  schema: {
    Page: Config.document('Page', {
      fields: {title: Field.text('Title', {searchable: true})}
    })
  },
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages', {contains: ['Page']})}
    })
  },
  embeddings: {semantic: {source: 'searchableText' as const, space}}
}
const identity = {
  project: 'project',
  namespace: 'main',
  epoch: '1',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}

for (const driver of ['native', 'wasm'] as const) {
  test(`${driver} distinguishes complete empty text slots from undeclared or invalidated slots`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      const emptyConfig = {
        ...config,
        schema: {
          Page: Config.document('Page', {fields: {title: Field.text('Title')}})
        }
      }
      const fixture = await createEntryResolver(emptyConfig, [
        {id: 'a', type: 'Page', index: 'a', title: 'Not searchable'}
      ])
      await buildDatabase(emptyConfig, db, fixture.source, identity)
      const store = new EmbeddingStore(db)
      const {runtime} = await openCheckpoint(emptyConfig, db, identity)
      const [row] = (await runtime.indexSnapshot()).entries
      const versionId = entryVersionId(
        row.entry.id,
        row.entry.locale,
        row.entry.versionStatus
      )
      expect(await store.pending(await embeddingHash(space))).toEqual([])
      expect(
        await store.candidates(
          await store.revision(),
          [{versionId, payloadId: row.payloadId!}],
          space,
          'semantic'
        )
      ).toEqual([])
      await expect(
        store.candidates(
          await store.revision(),
          [{versionId, payloadId: row.payloadId!}],
          space,
          'unconfigured'
        )
      ).rejects.toThrow()
      await store.invalidateOwners([versionId])
      await expect(
        store.candidates(
          await store.revision(),
          [{versionId, payloadId: row.payloadId!}],
          space,
          'semantic'
        )
      ).rejects.toThrow()
    } finally {
      db.close()
    }
  })
  test(`${driver} prepares durable text jobs during build and invalidates changed or deleted source owners`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    let runner: EmbeddingRunner | undefined
    try {
      const entries = [
        {id: 'a', type: 'Page', index: 'a', title: 'First'},
        {id: 'b', type: 'Page', index: 'b', title: 'Second'},
        {id: 'c', type: 'Page', index: 'c', title: 'Third'}
      ]
      const original = await createEntryResolver(config, entries)
      await buildDatabase(config, db, original.source, identity)
      const store = new EmbeddingStore(db),
        spaceId = await embeddingHash(space)
      const jobs = await store.pending(spaceId)
      expect(jobs).toHaveLength(3)
      const a = jobs.find(job => job.target.owner.versionId.includes('"a"'))!
      const b = jobs.find(job => job.target.owner.versionId.includes('"b"'))!
      const c = jobs.find(job => job.target.owner.versionId.includes('"c"'))!
      const mediaJobs = await Promise.all(
        (
          [
            ['image', a],
            ['document', c]
          ] as const
        ).map(([kind, job]) =>
          store.schedule({
            ...job.target,
            owner: {...job.target.owner, kind},
            slot: kind
          })
        )
      )
      const text = await loadEntryEmbeddingInput(db, a)
      expect(new TextDecoder().decode(text!.bytes)).toContain('First')
      let calls = 0
      runner = new EmbeddingRunner({
        store,
        load: job => loadEntryEmbeddingInput(db, job),
        provider: {
          space,
          async embed() {
            calls++
            return {spaceId, vector: [1, 0]}
          }
        }
      })
      expect(calls).toBe(0)
      expect(
        (await runner.run()).every(result => result.status === 'installed')
      ).toBe(true)
      expect(calls).toBe(3)
      const before = await store.revision()
      await reconcileDatabase(config, db, original.source, identity)
      expect(await store.revision()).toBe(before)
      const edited = await createEntryResolver(config, [
        {...entries[0], title: 'Changed'},
        entries[1]
      ])
      await reconcileDatabase(config, db, edited.source, identity)
      expect(await store.load(b)).toEqual([1, 0])
      expect(await store.manifest(a.id)).not.toMatchObject({
        generation: a.generation
      })
      expect(await store.manifest(c.id)).toBeUndefined()
      expect(await loadEntryEmbeddingInput(db, a)).toBeUndefined()
      await expect(store.install(a, [0, 1])).rejects.toThrow('Obsolete')
      await expect(store.install(c, [0, 1])).rejects.toThrow('Obsolete')
      for (const job of mediaJobs)
        await expect(store.install(job, [1, 0])).rejects.toThrow('Obsolete')
      const pending = await store.pending(spaceId)
      expect(pending).toHaveLength(1)
      expect(
        new TextDecoder().decode(
          (await loadEntryEmbeddingInput(db, pending[0]))!.bytes
        )
      ).toContain('Changed')
      expect((await runner.run())[0].status).toBe('installed')
      expect(calls).toBe(4)
      await reconcileDatabase(config, db, original.source, identity)
      expect((await store.manifest(a.id))!.generation).not.toBe(a.generation)
      expect((await store.manifest(c.id))!.generation).not.toBe(c.generation)
      expect(await store.pending(spaceId)).toHaveLength(2)
      expect(await store.load(b)).toEqual([1, 0])
      expect(
        (await openCheckpoint(config, db, identity)).descriptor.sourceSha
      ).toBe((await original.source.getTree()).sha)
    } finally {
      await runner?.close()
      db.close()
    }
  })

  test(`${driver} source rollback restores embedding publications and jobs`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      const original = await createEntryResolver(config, [
        {id: 'a', type: 'Page', index: 'a', title: 'Original'}
      ])
      const edited = await createEntryResolver(config, [
        {id: 'a', type: 'Page', index: 'a', title: 'Changed'}
      ])
      await buildDatabase(config, db, original.source, identity)
      const store = new EmbeddingStore(db),
        spaceId = await embeddingHash(space)
      const [job] = await store.pending(spaceId)
      await store.install(job, [1, 0])
      const revision = await store.revision()
      await db.run(
        sql`create trigger fail_embedding_source before update on alinea_checkpoint begin select raise(abort, 'source failure'); end`
      )
      await expect(
        reconcileDatabase(config, db, edited.source, identity)
      ).rejects.toThrow('source failure')
      expect(await store.revision()).toBe(revision)
      expect(await store.load(job)).toEqual([1, 0])
      expect(
        await store.candidates(
          revision,
          [
            {
              versionId: job.target.owner.versionId,
              payloadId: job.target.ownerPayloadId
            }
          ],
          space,
          'semantic'
        )
      ).toEqual([job.id])
      expect(
        (await openCheckpoint(config, db, identity)).descriptor.sourceSha
      ).toBe((await original.source.getTree()).sha)
    } finally {
      db.close()
    }
  })
}

test('native-built text jobs and immutable input reload in WASM without normalization', async () => {
  const fixture = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Portable input'}
  ])
  using native = new Database(':memory:')
  await buildDatabase(config, connect(native), fixture.source, identity)
  const db = await wasmDatabase(native.serialize())
  let runner: EmbeddingRunner | undefined
  try {
    await openCheckpoint(config, db, identity)
    const store = new EmbeddingStore(db),
      spaceId = await embeddingHash(space)
    runner = new EmbeddingRunner({
      store,
      load: job => loadEntryEmbeddingInput(db, job),
      provider: {
        space,
        async embed(input) {
          expect(new TextDecoder().decode(input.bytes)).toContain(
            'Portable input'
          )
          return {spaceId, vector: [1, 0]}
        }
      }
    })
    expect((await runner.run())[0].status).toBe('installed')
  } finally {
    await runner?.close()
    db.close()
  }
})
