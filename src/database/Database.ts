import {
  DatabaseIndex,
  type IndexContribution,
  type IndexedRecord
} from './SecondaryIndex.js'

export interface DatabaseRecord {
  id: string
}

export interface PutRecord<Row> {
  op: 'put'
  record: Row
}

export interface DeleteRecord {
  op: 'delete'
  id: string
}

export type DatabaseChange<Row> = DeleteRecord | PutRecord<Row>

export interface ChangedIndexBucket {
  index: string
  key: string
}

export interface DatabaseChangeSet {
  fromRevision: string
  toRevision: string
  records: ReadonlySet<string>
  indexes: ReadonlyArray<ChangedIndexBucket>
}

export interface DatabaseCommit<Row extends DatabaseRecord> {
  snapshot: DatabaseSnapshot<Row>
  changes: DatabaseChangeSet
}

export class DatabaseSchema<Row> {
  #indexes = new Map<string, DatabaseIndex<Row, unknown>>()
  #sealed = false

  get indexes(): ReadonlyArray<DatabaseIndex<Row, unknown>> {
    return [...this.#indexes.values()]
  }

  add<Metadata>(index: DatabaseIndex<Row, Metadata>): this {
    if (this.#sealed)
      throw new Error('Cannot add an index after the database schema is in use')
    if (this.#indexes.has(index.name))
      throw new Error(`Duplicate database index "${index.name}"`)
    this.#indexes.set(
      index.name,
      index as unknown as DatabaseIndex<Row, unknown>
    )
    return this
  }

  has<Metadata>(index: DatabaseIndex<Row, Metadata>): boolean {
    return this.#indexes.get(index.name) === index
  }

  get(name: string): DatabaseIndex<Row, unknown> | undefined {
    return this.#indexes.get(name)
  }

  seal(): void {
    this.#sealed = true
  }
}

type IndexBuckets = ReadonlyMap<
  string,
  ReadonlyMap<string, ReadonlyArray<IndexedRecord<unknown>>>
>

export interface CreateDatabaseOptions<Row> {
  schema: DatabaseSchema<Row>
  revision: string
  records?: Iterable<Row>
}

/** An immutable, revisioned collection of records and materialized indexes. */
export class DatabaseSnapshot<Row extends DatabaseRecord> {
  readonly revision: string
  readonly schema: DatabaseSchema<Row>
  #records: ReadonlyMap<string, Row>
  #indexes: IndexBuckets

  constructor(options: CreateDatabaseOptions<Row>) {
    this.revision = options.revision
    this.schema = options.schema
    this.schema.seal()
    const records = new Map<string, Row>()
    for (const record of options.records ?? []) {
      if (records.has(record.id))
        throw new Error(`Duplicate database record "${record.id}"`)
      records.set(record.id, record)
    }
    this.#records = records
    this.#indexes = buildIndexes(this.schema, records.values())
  }

  static fromState<Row extends DatabaseRecord>(
    revision: string,
    schema: DatabaseSchema<Row>,
    records: ReadonlyMap<string, Row>,
    indexes: IndexBuckets
  ): DatabaseSnapshot<Row> {
    const snapshot = new DatabaseSnapshot<Row>({revision, schema})
    snapshot.#records = records
    snapshot.#indexes = indexes
    return snapshot
  }

  get size(): number {
    return this.#records.size
  }

  get(id: string): Row | undefined {
    return this.#records.get(id)
  }

  has(id: string): boolean {
    return this.#records.has(id)
  }

  records(): Iterable<Row> {
    return this.#records.values()
  }

  scan<Metadata>(
    index: DatabaseIndex<Row, Metadata>,
    key: string
  ): ReadonlyArray<IndexedRecord<Metadata>> {
    if (!this.schema.has(index))
      throw new Error(`Index "${index.name}" does not belong to this database`)
    return (this.#indexes.get(index.name)?.get(key) ?? []) as ReadonlyArray<
      IndexedRecord<Metadata>
    >
  }

  buckets<Metadata>(
    index: DatabaseIndex<Row, Metadata>
  ): Iterable<readonly [string, ReadonlyArray<IndexedRecord<Metadata>>]> {
    if (!this.schema.has(index))
      throw new Error(`Index "${index.name}" does not belong to this database`)
    return (this.#indexes.get(index.name) ?? new Map()) as ReadonlyMap<
      string,
      ReadonlyArray<IndexedRecord<Metadata>>
    >
  }

  apply(
    toRevision: string,
    changes: Iterable<DatabaseChange<Row>>
  ): DatabaseCommit<Row> {
    if (toRevision === this.revision)
      throw new Error(`Database revision did not change: "${toRevision}"`)

    const finalChanges = new Map<string, DatabaseChange<Row>>()
    for (const change of changes) {
      const id = change.op === 'put' ? change.record.id : change.id
      finalChanges.set(id, change)
    }

    const records = new Map(this.#records)
    const indexes = new Map(this.#indexes)
    const mutableIndexes = new Map<
      string,
      Map<string, ReadonlyArray<IndexedRecord<unknown>>>
    >()
    const changedRecords = new Set<string>()
    const changedBuckets = new Map<string, ChangedIndexBucket>()

    for (const [id, change] of finalChanges) {
      const previous = records.get(id)
      const next = change.op === 'put' ? change.record : undefined
      if (!previous && !next) continue
      if (next) records.set(id, next)
      else records.delete(id)
      changedRecords.add(id)

      for (const index of this.schema.indexes) {
        const before = previous ? index.project(previous) : []
        const after = next ? index.project(next) : []
        if (index.contributionsEqual(before, after)) continue
        const keys = new Set([
          ...before.map(contribution => contribution.key),
          ...after.map(contribution => contribution.key)
        ])
        let buckets = mutableIndexes.get(index.name)
        if (!buckets) {
          buckets = new Map(indexes.get(index.name) ?? [])
          mutableIndexes.set(index.name, buckets)
          indexes.set(index.name, buckets)
        }
        for (const key of keys) {
          const additions = after.filter(
            contribution => contribution.key === key
          )
          const bucket = (buckets.get(key) ?? []).filter(item => item.id !== id)
          bucket.push(
            ...additions.map(contribution => indexedRecord(id, contribution))
          )
          bucket.sort((left, right) => index.compare(left, right))
          if (bucket.length > 0) buckets.set(key, bucket)
          else buckets.delete(key)
          changedBuckets.set(`${index.name}\0${key}`, {index: index.name, key})
        }
      }
    }

    return {
      snapshot: DatabaseSnapshot.fromState(
        toRevision,
        this.schema,
        records,
        indexes
      ),
      changes: {
        fromRevision: this.revision,
        toRevision,
        records: changedRecords,
        indexes: [...changedBuckets.values()]
      }
    }
  }
}

export function diffDatabaseSnapshots<Row extends DatabaseRecord>(
  previous: DatabaseSnapshot<Row>,
  next: DatabaseSnapshot<Row>
): DatabaseCommit<Row> {
  if (previous.schema !== next.schema)
    throw new Error('Cannot diff snapshots with different schemas')
  const changes: Array<DatabaseChange<Row>> = []
  const previousRecords = new Map(
    [...previous.records()].map(record => [record.id, record])
  )
  const nextRecords = new Map(
    [...next.records()].map(record => [record.id, record])
  )
  const ids = new Set([...previousRecords.keys(), ...nextRecords.keys()])
  for (const id of ids) {
    const before = previousRecords.get(id)
    const after = nextRecords.get(id)
    if (!after) changes.push({op: 'delete', id})
    else if (!before || JSON.stringify(before) !== JSON.stringify(after))
      changes.push({op: 'put', record: after})
  }
  return previous.apply(next.revision, changes)
}

function buildIndexes<Row extends DatabaseRecord>(
  schema: DatabaseSchema<Row>,
  records: Iterable<Row>
): IndexBuckets {
  const indexes = new Map<string, Map<string, Array<IndexedRecord<unknown>>>>()
  for (const index of schema.indexes) indexes.set(index.name, new Map())
  for (const record of records) {
    for (const index of schema.indexes) {
      const buckets = indexes.get(index.name)!
      for (const contribution of index.project(record)) {
        const bucket = buckets.get(contribution.key) ?? []
        bucket.push(indexedRecord(record.id, contribution))
        buckets.set(contribution.key, bucket)
      }
    }
  }
  for (const index of schema.indexes) {
    const buckets = indexes.get(index.name)!
    for (const bucket of buckets.values())
      bucket.sort((left, right) => index.compare(left, right))
  }
  return indexes
}

function indexedRecord<Metadata>(
  id: string,
  contribution: IndexContribution<Metadata>
): IndexedRecord<Metadata> {
  return {
    id,
    order: contribution.order ?? [],
    metadata: contribution.metadata
  }
}
