import {describe, expect, test} from 'bun:test'
import {DatabaseSnapshot} from '../Database.js'
import {
  ReplicaDatabaseReader,
  type ReplicaIndexedMetadata,
  replicaIndexKey
} from '../Reader.js'
import type {IndexReader} from '../replica/IndexReader.js'
import type {QueryDependency} from '../replica/Dependency.js'
import type {FrameDescriptor, RecordReference} from '../replica/Types.js'
import {entriesByType, entryDatabaseSchema} from './Indexes.js'
import type {
  AlineaDatabaseRecord,
  EntryCoreRecord,
  EntryPayloadRecord
} from './Model.js'
import {EntryQueryEngine} from './Query.js'

function entry(
  id: string,
  entryId: string,
  options: Partial<EntryCoreRecord> = {}
): EntryCoreRecord {
  return {
    kind: 'entry',
    id,
    entryId,
    versionStatus: 'published',
    status: 'published',
    active: true,
    main: true,
    type: 'Page',
    title: entryId,
    seeded: null,
    workspace: 'main',
    root: 'pages',
    locale: null,
    level: 0,
    index: id,
    parentId: null,
    parents: [],
    path: entryId,
    url: `/${entryId}`,
    ...options
  }
}

describe('EntryQueryEngine', () => {
  test('uses structural indexes and status preference', async () => {
    const records: Array<AlineaDatabaseRecord> = [
      entry('home:published', 'home', {index: 'a'}),
      entry('about:published', 'about', {
        index: 'b',
        parentId: 'home',
        level: 1,
        active: false
      }),
      entry('about:draft', 'about', {
        index: 'b',
        parentId: 'home',
        level: 1,
        versionStatus: 'draft',
        status: 'draft',
        main: false
      })
    ]
    const database = new DatabaseSnapshot({
      schema: entryDatabaseSchema,
      revision: 'one',
      records
    })
    const query = new EntryQueryEngine(database)

    expect(
      (
        await query.find({
          parentId: 'home',
          workspace: 'main',
          root: 'pages',
          status: 'preferDraft'
        })
      ).map(record => record.id)
    ).toEqual(['about:draft'])
    expect(await query.count({type: 'Page', status: 'published'})).toBe(2)
  })

  test('keeps payload records out of structural indexes', async () => {
    const core = entry('home:published', 'home')
    const payload: EntryPayloadRecord = {
      kind: 'payload',
      id: `payload:${core.id}`,
      data: {body: 'Before'}
    }
    const before = new DatabaseSnapshot({
      schema: entryDatabaseSchema,
      revision: 'one',
      records: [core, payload]
    })
    const {snapshot: after, changes} = before.apply('two', [
      {
        op: 'put',
        record: {...payload, data: {body: 'After'}}
      }
    ])

    expect(await new EntryQueryEngine(after).count({status: 'all'})).toBe(1)
    expect(changes.indexes).toEqual([])
  })

  test('runs the same query against a lazy replica reader', async () => {
    const core = entry('home:published', 'home')
    const projected = entriesByType.project(core)[0]
    const reader = new CountingReplicaReader(
      [core],
      new Map([
        [
          replicaIndexKey(entriesByType.name, 'Page'),
          [
            {
              id: core.id,
              frame: frame(core.id),
              metadata: {
                order: projected.order ?? [],
                metadata: projected.metadata
              }
            }
          ]
        ]
      ])
    )
    const query = new EntryQueryEngine(new ReplicaDatabaseReader(reader))

    expect(await query.count({type: 'Page'})).toBe(1)
    expect(reader.gets).toBe(0)
    expect((await query.find({type: 'Page'})).map(record => record.id)).toEqual(
      [core.id]
    )
    expect(reader.gets).toBe(1)
  })
})

class CountingReplicaReader implements IndexReader<
  AlineaDatabaseRecord,
  ReplicaIndexedMetadata<unknown>
> {
  readonly revision = 'one'
  gets = 0
  #records: ReadonlyMap<string, AlineaDatabaseRecord>
  #indexes: ReadonlyMap<
    string,
    ReadonlyArray<RecordReference<ReplicaIndexedMetadata<unknown>>>
  >

  constructor(
    records: ReadonlyArray<AlineaDatabaseRecord>,
    indexes: ReadonlyMap<
      string,
      ReadonlyArray<RecordReference<ReplicaIndexedMetadata<unknown>>>
    >
  ) {
    this.#records = new Map(records.map(record => [record.id, record]))
    this.#indexes = indexes
  }

  async get(id: string): Promise<AlineaDatabaseRecord | undefined> {
    this.gets++
    return this.#records.get(id)
  }

  async *scan(
    key: string
  ): AsyncIterable<RecordReference<ReplicaIndexedMetadata<unknown>>> {
    yield* this.#indexes.get(key) ?? []
  }

  async load(
    references: Iterable<RecordReference<ReplicaIndexedMetadata<unknown>>>
  ): Promise<ReadonlyMap<string, AlineaDatabaseRecord>> {
    const result = new Map<string, AlineaDatabaseRecord>()
    for (const reference of references) {
      const record = await this.get(reference.id)
      if (record) result.set(reference.id, record)
    }
    return result
  }

  dependencies(): ReadonlySet<QueryDependency> {
    return new Set()
  }
}

function frame(id: string): FrameDescriptor {
  return {
    id,
    accessClassId: 'test',
    offset: 0,
    length: 0,
    nonce: new Uint8Array(),
    cipherHash: id,
    compression: 'none'
  }
}
