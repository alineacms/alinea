import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
import {FSSource} from '#/core/source/FSSource.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {cms} from '#test/cms.js'
import {entrySource} from '../entry/Schema.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {openCheckpoint} from '../runtime/Checkpoint.js'
import {EntryRuntime, type EntryReplacement} from '../runtime/EntryRuntime.js'
import {wasmDatabase} from './WasmDatabase.js'
import {SqlSource} from '../source/SqlSource.js'

test('WASM source batches retain distinct binary blobs after stepping statements', async () => {
  const db = await wasmDatabase()
  try {
    await SqlSource.createSchema(db)
    const source = await SqlSource.create(db, 'main')
    const blobs = await Promise.all(
      Array.from({length: 12}, async (_, i) => {
        const contents = new Uint8Array(8192).fill(i)
        return {contents, sha: await hashBlob(contents)}
      })
    )
    await source.applyChanges({
      fromSha: (await source.getSqlTree()).sha,
      changes: blobs.map((blob, i) => ({op: 'add', path: `${i}.bin`, ...blob}))
    })
    const received = new Map(
      await Array.fromAsync(source.getBlobs(blobs.map(blob => blob.sha)))
    )
    for (const blob of blobs) {
      const contents = received.get(blob.sha)
      expect(contents).toBeDefined()
      expect(await hashBlob(contents!)).toBe(blob.sha)
    }
  } finally {
    db.close()
  }
})

test('WASM opens a native SQLite checkpoint and executes the same Graph queries', async () => {
  const source = new FSSource('test/fixtures/demo')
  const index = new EntryIndex(cms.config)
  await index.syncWith(source)
  const resolver = new EntryResolver(cms.config, index)
  const identity = {configId: 'wasm-test', namespace: 'main', releaseId: 'r1'}
  using native = new Database(':memory:')
  await buildDatabase(cms.config, connect(native), source, identity)
  const db = await wasmDatabase(native.serialize())
  try {
    const {runtime} = await openCheckpoint(cms.config, db, identity)
    const queries: Array<GraphQuery> = [
      {select: Entry},
      {select: Entry.id, skip: 2, take: 3},
      {select: {id: Entry.id, children: {edge: 'children', select: Entry.id}}},
      {select: {id: Entry.id, parents: {edge: 'parents', select: Entry.title}}},
      {select: Entry.id, groupBy: Entry.type},
      {select: Entry.id, count: true}
    ]
    for (const query of queries)
      expect(await runtime.resolve(query)).toEqual(
        await resolver.resolve(query)
      )
  } finally {
    db.close()
  }
})

test('WASM lazily hydrates payloads, reuses the cache and delivers live changes', async () => {
  const index = new EntryIndex(cms.config)
  await index.syncWith(new FSSource('test/fixtures/demo'))
  const entries: Array<EntryReplacement> = []
  const payloads = new Map<
    string,
    {data: Record<string, unknown>; source: ReturnType<typeof entrySource>}
  >()
  for (const entry of index.filter({})) {
    const payloadId = `payload-${entries.length}`
    entries.push({
      entry: {...entry, versionStatus: entry.status, ordinal: entries.length},
      payloadId
    })
    payloads.set(payloadId, {data: entry.data, source: entrySource(entry)})
  }
  const db = await wasmDatabase()
  try {
    await EntryRuntime.createSchema(db, 'empty')
    const loads: Array<string> = []
    const runtime = new EntryRuntime(cms.config, db, {
      async load(requests) {
        return requests.map(request => {
          loads.push(request.payloadId)
          const payload = payloads.get(request.payloadId)
          if (!payload) throw new Error('Missing test payload')
          return {...request, ...payload}
        })
      }
    })
    await runtime.apply({fromRevision: 'empty', toRevision: 'r1', entries})
    const [id] = await runtime.find({select: Entry.id, take: 1})
    expect(loads).toEqual([])
    const query = {id, select: Entry.data, take: 1}
    const expected = await new EntryResolver(cms.config, index).resolve(query)
    expect(await runtime.find(query)).toEqual(expected)
    expect(loads).toHaveLength(1)
    expect(await runtime.find(query)).toEqual(expected)
    expect(loads).toHaveLength(1)

    const initial = Promise.withResolvers<unknown>()
    const changed = Promise.withResolvers<unknown>()
    let deliveries = 0
    const unsubscribe = runtime.subscribe(
      {id, select: Entry.title},
      {
        next(value) {
          if (++deliveries === 1) initial.resolve(value)
          else changed.resolve(value)
        },
        error(error) {
          initial.reject(error)
          changed.reject(error)
        }
      }
    )
    try {
      const original = entries.find(value => value.entry.id === id)!
      expect(await initial.promise).toEqual([original.entry.title])
      const updated = {
        ...original,
        entry: {...original.entry, title: 'Updated in WASM'}
      }
      await runtime.apply({
        fromRevision: 'r1',
        toRevision: 'r2',
        entries: [updated]
      })
      expect(await changed.promise).toEqual(['Updated in WASM'])
      expect(await runtime.find(query)).toEqual(expected)
      expect(loads).toHaveLength(1)
      await expect(
        runtime.apply({
          fromRevision: 'r2',
          toRevision: 'bad',
          entries: [original, original]
        })
      ).rejects.toThrow('Duplicate entry')
      expect(await runtime.getRevision()).toBe('r2')
      expect(await runtime.find({id, select: Entry.title})).toEqual([
        'Updated in WASM'
      ])
    } finally {
      unsubscribe()
    }
  } finally {
    db.close()
  }
})
