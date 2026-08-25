export type IndexScalar = boolean | number | string | null

export interface IndexContribution<Metadata> {
  key: string
  order?: ReadonlyArray<IndexScalar>
  metadata: Metadata
}

export interface IndexedRecord<Metadata> {
  id: string
  order: ReadonlyArray<IndexScalar>
  metadata: Metadata
}

export interface DatabaseIndexOptions<Row, Metadata> {
  name: string
  project(record: Row): Iterable<IndexContribution<Metadata>>
  metadataEqual?(left: Metadata, right: Metadata): boolean
}

/**
 * A materialized secondary index. Metadata is a covering projection that
 * queries can use without loading the complete record.
 */
export class DatabaseIndex<Row, Metadata> {
  readonly name: string
  #project: DatabaseIndexOptions<Row, Metadata>['project']
  #metadataEqual: (left: Metadata, right: Metadata) => boolean

  constructor(options: DatabaseIndexOptions<Row, Metadata>) {
    this.name = options.name
    this.#project = options.project
    this.#metadataEqual = options.metadataEqual ?? Object.is
  }

  project(record: Row): ReadonlyArray<IndexContribution<Metadata>> {
    return Array.from(this.#project(record), contribution => ({
      key: contribution.key,
      order: contribution.order ? [...contribution.order] : [],
      metadata: contribution.metadata
    }))
  }

  compare(
    left: IndexedRecord<Metadata>,
    right: IndexedRecord<Metadata>
  ): number {
    const length = Math.max(left.order.length, right.order.length)
    for (let index = 0; index < length; index++) {
      const compared = compareIndexScalar(left.order[index], right.order[index])
      if (compared !== 0) return compared
    }
    return compareIndexScalar(left.id, right.id)
  }

  contributionsEqual(
    left: ReadonlyArray<IndexContribution<Metadata>>,
    right: ReadonlyArray<IndexContribution<Metadata>>
  ): boolean {
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index++) {
      const a = left[index]
      const b = right[index]
      if (a.key !== b.key) return false
      if (!indexOrderEqual(a.order ?? [], b.order ?? [])) return false
      if (!this.#metadataEqual(a.metadata, b.metadata)) return false
    }
    return true
  }
}

function indexOrderEqual(
  left: ReadonlyArray<IndexScalar>,
  right: ReadonlyArray<IndexScalar>
): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => Object.is(value, right[index]))
}

function compareIndexScalar(
  left: IndexScalar | undefined,
  right: IndexScalar | undefined
): number {
  if (Object.is(left, right)) return 0
  if (left === undefined) return -1
  if (right === undefined) return 1
  if (left === null) return -1
  if (right === null) return 1
  if (typeof left === typeof right) return left < right ? -1 : 1
  return String(left) < String(right) ? -1 : 1
}
