import {suite} from '@alinea/suite'
import type {FrameLoader} from './Bundle.js'
import {CachedFrameLoader} from './Bundle.js'
import {diffCatalogs} from './Catalog.js'
import {JsonReplicaCodec} from './IndexReader.js'
import {LiveQueryManager, type QueryResolver} from './LiveQuery.js'
import {ReplicaSnapshot, ReplicaStore} from './Snapshot.js'
import type {FrameDescriptor, IndexBucket, ReplicaCatalog} from './Types.js'

const test = suite(import.meta)
const encoder = new TextEncoder()

interface TestRecord {
  id: string
  title: string
}

interface TestMetadata {
  title: string
}

class TestFrameLoader implements FrameLoader {
  calls = new Map<string, number>()
  #contents: ReadonlyMap<string, Uint8Array>

  constructor(contents: ReadonlyMap<string, Uint8Array>) {
    this.#contents = contents
  }

  async load(frame: FrameDescriptor): Promise<Uint8Array> {
    const key = `${frame.id}:${frame.cipherHash}`
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1)
    const contents = this.#contents.get(key)
    if (!contents) throw new Error(`Missing test frame ${key}`)
    return contents
  }
}

test('lazy reader loads indexes before selected records and tracks dependencies', async () => {
  const fixture = createFixture('r1', {
    a: {id: 'a', title: 'A'},
    b: {id: 'b', title: 'B'}
  })
  const source = new TestFrameLoader(fixture.contents)
  const loader = new CachedFrameLoader(source)
  const snapshot = new ReplicaSnapshot(
    fixture.catalog,
    loader,
    new JsonReplicaCodec<TestRecord, TestMetadata>()
  )
  const reader = snapshot.reader()

  test.equal(source.calls.size, 0)
  const references = []
  for await (const reference of reader.scan('children:root')) {
    references.push(reference)
  }
  test.equal(
    references.map(reference => reference.id),
    ['a', 'b']
  )
  test.equal(source.calls.size, 1)

  const records = await reader.load(references)
  test.equal(Array.from(records.values()), [
    {id: 'a', title: 'A'},
    {id: 'b', title: 'B'}
  ])
  test.equal(Array.from(reader.dependencies()).sort(), [
    'index:children:root',
    'record:a',
    'record:b'
  ])

  await Promise.all([reader.get('a'), reader.get('a')])
  test.equal(source.calls.get('record-a:record-a-A'), 1)
})

test('catalog changes ignore physical offsets but detect logical content', () => {
  const first = createFixture('r1', {a: {id: 'a', title: 'A'}}).catalog
  const shifted: ReplicaCatalog = {
    ...first,
    revision: 'r2',
    records: {
      a: {...first.records.a, offset: first.records.a.offset + 100}
    }
  }
  const changed = diffCatalogs(first, shifted)
  test.equal(Array.from(changed.records), [])

  const updated: ReplicaCatalog = {
    ...shifted,
    revision: 'r3',
    records: {
      a: {...shifted.records.a, cipherHash: 'changed'}
    }
  }
  test.equal(Array.from(diffCatalogs(shifted, updated).records), ['a'])
})

test('live queries rerun only when a dependency changes', async () => {
  const first = createFixture('r1', {
    a: {id: 'a', title: 'A'},
    unrelated: {id: 'unrelated', title: 'Unrelated'}
  })
  const store = new ReplicaStore(createSnapshot(first))
  const resolver: QueryResolver<
    string,
    ReadonlyArray<string>,
    TestRecord,
    TestMetadata
  > = {
    async resolve(key, reader) {
      const references = []
      for await (const reference of reader.scan(key)) references.push(reference)
      const records = await reader.load(references)
      return Array.from(records.values(), record => record.title)
    }
  }
  const live = new LiveQueryManager(store, resolver)
  const received: Array<ReadonlyArray<string>> = []
  const subscription = live.subscribe('children:root', result => {
    received.push(result)
  })
  await subscription.ready
  test.equal(received, [['A']])

  const unrelated = createFixture('r2', {
    a: {id: 'a', title: 'A'},
    unrelated: {id: 'unrelated', title: 'Changed elsewhere'}
  })
  store.install(createSnapshot(unrelated))
  await Promise.resolve()
  await Promise.resolve()
  test.equal(received, [['A']])

  const updated = createFixture('r3', {
    a: {id: 'a', title: 'Updated'},
    unrelated: {id: 'unrelated', title: 'Changed elsewhere'}
  })
  let resolveUpdate!: () => void
  const updateReceived = new Promise<void>(resolve => {
    resolveUpdate = resolve
  })
  const second = live.subscribe(
    'children:root',
    result => {
      if (result[0] === 'Updated') resolveUpdate()
    },
    {equal: (left, right) => left.join('\0') === right.join('\0')}
  )
  await second.ready
  store.install(createSnapshot(updated))
  await updateReceived
  test.equal(received, [['A'], ['Updated']])

  second.unsubscribe()
  subscription.unsubscribe()
})

test('empty index scans remain live when their first record appears', async () => {
  const empty = createFixture('r1', {})
  const store = new ReplicaStore(createSnapshot(empty))
  const resolver: QueryResolver<
    string,
    ReadonlyArray<string>,
    TestRecord,
    TestMetadata
  > = {
    async resolve(key, reader) {
      const ids = []
      for await (const reference of reader.scan(key)) ids.push(reference.id)
      return ids
    }
  }
  const live = new LiveQueryManager(store, resolver)
  let resolvePopulated!: () => void
  const populated = new Promise<void>(resolve => {
    resolvePopulated = resolve
  })
  const received: Array<ReadonlyArray<string>> = []
  const subscription = live.subscribe('children:root', result => {
    received.push(result)
    if (result.length === 1) resolvePopulated()
  })
  await subscription.ready

  store.install(createSnapshot(createFixture('r2', {a: {id: 'a', title: 'A'}})))
  await populated
  test.equal(received, [[], ['a']])
  subscription.unsubscribe()
})

interface Fixture {
  catalog: ReplicaCatalog
  contents: ReadonlyMap<string, Uint8Array>
}

function createFixture(
  revision: string,
  records: Readonly<Record<string, TestRecord>>
): Fixture {
  const contents = new Map<string, Uint8Array>()
  const descriptors: Record<string, FrameDescriptor> = {}
  for (const [id, record] of Object.entries(records)) {
    const hash = `record-${id}-${revisionFor(record, revision)}`
    const frame = descriptor(`record-${id}`, hash)
    descriptors[id] = frame
    contents.set(`${frame.id}:${frame.cipherHash}`, encode(record))
  }
  const visible = Object.values(records).filter(
    record => record.id !== 'unrelated'
  )
  const bucket: IndexBucket<TestMetadata> = {
    records: visible.map(record => ({
      id: record.id,
      metadata: {title: record.title}
    }))
  }
  const indexHash = `index-${visible.map(record => `${record.id}:${record.title}`).join('|')}`
  const index = descriptor('index-children-root', indexHash)
  contents.set(`${index.id}:${index.cipherHash}`, encode(bucket))
  return {
    catalog: {
      version: 1,
      bundleId: 'bundle-1',
      bundleUrl: '/admin/release/release-1/replica.bundle',
      revision,
      records: descriptors,
      indexes: {'children:root': index}
    },
    contents
  }
}

function createSnapshot(fixture: Fixture) {
  return new ReplicaSnapshot(
    fixture.catalog,
    new CachedFrameLoader(new TestFrameLoader(fixture.contents)),
    new JsonReplicaCodec<TestRecord, TestMetadata>()
  )
}

function descriptor(id: string, hash: string): FrameDescriptor {
  return {
    id,
    accessClassId: 'readable',
    offset: 0,
    length: 0,
    nonce: new Uint8Array(),
    cipherHash: hash,
    compression: 'none'
  }
}

function revisionFor(record: TestRecord, revision: string): string {
  return record.id === 'unrelated'
    ? `${revision}-${record.title}`
    : record.title
}

function encode(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value))
}
