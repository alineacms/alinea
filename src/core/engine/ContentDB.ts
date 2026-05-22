import {Packr} from 'msgpackr'

export type Primitive = string | number | boolean | null
export type FieldDirective =
  | 'payload'
  | 'column'
  | 'exact'
  | 'range'
  | 'dictionary'

export interface ContentShape<Meta, Derived> {
  /**
   * Field that acts as the stable primary key.
   *
   * ContentDB stores the lookup value in Zone 2/4 and reconstructs this field
   * from the registry at runtime, so it should not also be stored as a normal
   * column or payload value.
   */
  readonly lookup: keyof Meta & string
  readonly global: Readonly<Record<string, FieldDirective>>
  derive(meta: Meta, store: Queryable<Meta & Derived>): Derived
  type(meta: Meta): string
  fields(type: string): Readonly<Record<string, FieldDirective>>
  paths(type: string): ReadonlyArray<string>
}

export interface Queryable<Row> {
  get(lookupKey: string): number | undefined
  find(filter: Filter<Row>, options?: FindOptions): Iterable<number>
  count(filter: Filter<Row>, options?: FindOptions): number
  findKeys(filter: Filter<Row>, options?: FindOptions): Iterable<string>
  pick(
    id: number,
    fields: ReadonlyArray<string>
  ): Partial<Row & Record<string, any>>
}

export interface ContentStore<Meta, Derived> extends Queryable<Meta & Derived> {
  upsert<Payload>(meta: Meta, payload: Payload): void
  compile(): ArrayBuffer
}

export interface Ops<Value = unknown> {
  is?: Value
  isNot?: Value
  in?: ReadonlyArray<Value>
  notIn?: ReadonlyArray<Value>
  gt?: Value
  gte?: Value
  lt?: Value
  lte?: Value
  startsWith?: string
}
export interface ObjectOps<Fields> {
  has?: Filter<Fields>
}
export interface ArrayOps<Fields> {
  includes?: Filter<Fields>
}
export type FieldOps<Fields> = {[K in keyof Fields]?: Condition<Fields[K]>}
export type Condition<Value> = [Value] extends [Primitive]
  ? Ops<Value> | Value
  : [Value] extends [Array<any>]
    ? ArrayOps<Value[0]>
    : ObjectOps<Value> & FieldOps<Value>
export type AndCondition<Fields> = {and: Array<Filter<Fields> | undefined>}
export type OrCondition<Fields> = {or: Array<Filter<Fields> | undefined>}
export type Filter<Fields = unknown> =
  | AndCondition<Fields>
  | OrCondition<Fields>
  | FieldOps<Fields>

export type HashFunction = (value: string) => bigint

export interface QueryPlanStats {
  fastPathFields: string[]
  slowPathFields: string[]
  candidateCountBeforeSlow: number
  resultCount: number
}

export interface PickStats {
  hydratedFields: string[]
  decodedValueCount: number
  skippedValueCount: number
}

export interface ContentDBOptions {
  hash?: HashFunction
}

export interface FindOptions {
  /**
   * Restrict query execution to known type pools without changing the filter.
   *
   * This is a planner hint for callers that can infer the possible row types
   * from schema metadata. It should use ContentDB's persistent type pools as
   * row candidates, not ad-hoc per-query Set/Map indexes or hydrated scans.
   */
  types?: ReadonlyArray<string>
}

type AnyRecord = Record<string, any>

type StagedRecord<Meta> = {
  meta: Meta
  payload: AnyRecord
  lookupKey: string
  typeName: string
}

type PreparedRow = {
  row: AnyRecord
  lookupKey: string
  typeName: string
  typeId: number
  localRowIndex: number
  rowId: number
  payloadOffset: number
}

type RegistryEntry = {
  hash: bigint
  typeId: number
  localRowIndex: number
  payloadOffset: number
}

type RuntimeRow = RegistryEntry & {
  lookupKey?: string
  values?: Map<string, unknown>
}

type ColumnKind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

type RuntimeExactIndex = {
  keys: string[]
  starts: Uint32Array
  rowIds: ArrayLike<number>
}

type RuntimeRangeIndex = {
  values: number[]
  rowIds: number[]
}

type RuntimeColumn =
  | {kind: 0; values: Float64Array}
  | {
      kind: 1 | 3 | 5 | 6
      pairs: Uint32Array
      bytesStart: number
      bytesLength: number
      cache?: Array<string | null | undefined>
      exact?: RuntimeExactIndex
    }
  | {kind: 2; present: Uint8Array; values: Uint8Array}
  | {
      kind: 4
      values: Uint16Array
      dictionary: string[]
      exact: RuntimeExactIndex
    }
  | {kind: 7; exact: RuntimeExactIndex; reverse?: Array<string | undefined>}

type RuntimePool = {
  typeId: number
  typeName: string
  rowCount: number
  payloadFields: string[]
  columns: Map<string, RuntimeColumn>
  localRowToId: number[]
  exactIndexes: Map<string, RuntimeExactIndex>
  rangeIndexes: Map<string, RuntimeRangeIndex>
}

type RuntimeGlobalColumns = {
  rowCount: number
  columns: Map<string, RuntimeColumn>
  exactIndexes: Map<string, RuntimeExactIndex>
  rangeIndexes: Map<string, RuntimeRangeIndex>
}

/**
 * Runtime query execution is intentionally column-scan first.
 *
 * ContentDB's core advantage is cheap open plus compact typed columns. Hot
 * filters should therefore stream typed columns and sorted row-id arrays with
 * minimal allocation. Avoid per-query Set/Map planners or hydrated row scans on
 * indexed fields. Lazy side indexes are allowed only when they are persistent
 * column artifacts, encoded as compact sorted arrays, and preserve O(1) open.
 */

/**
 * Lazy view of a compiled buffer.
 *
 * Opening a binary validates only the master header, zone boundaries, and the
 * fixed Zone 2 length. Row structs, lookup-key literals, Zone 3 pools, and
 * global indexes are decoded lazily on first use. This keeps constructor/open
 * time close to O(1) with respect to row count.
 */
type RuntimeIndex = {
  buffer: ArrayBuffer
  view: DataView
  zone2Offset: number
  zone2Length: number
  zone3Offset: number
  zone3Length: number
  zone4Offset: number
  zone4Length: number
  rowCount: number
  rows: Map<number, RuntimeRow>
  globalColumns?: RuntimeGlobalColumns
  pools?: Map<number, RuntimePool>
  fieldToPools?: Map<string, RuntimePool[]>
  typeCandidates?: Map<string, number[]>
  payloadValueIndexes: Map<string, RuntimeExactIndex>
}

/**
 * Binary file format, version 2.
 *
 * All integer fields are little-endian. The top-level file is a single
 * contiguous ArrayBuffer with a fixed 64-byte header followed by three zones:
 *
 * Zone 1: Master Header, 64 bytes
 *   0..3    Uint32 magic, 0x414c4e41 ("ALNA")
 *   4..7    Uint32 format version
 *   8..15   Uint32 Zone 2 offset, Uint32 Zone 2 byte length
 *   16..23  Uint32 Zone 3 offset, Uint32 Zone 3 byte length
 *   24..31  Uint32 Zone 4 offset, Uint32 Zone 4 byte length
 *   32..63  zero padding reserved for future flags
 *
 * Zone 2: Global Registry Index
 *   A sorted array of 16-byte structs:
 *   0..7    Uint64 FNV-1a hash of lookupKey
 *   8..9    Uint16 type discriminator
 *   10..11  Uint16 local row index in that type pool
 *   12..15  Uint32 absolute byte offset into Zone 4
 *
 * Zone 3: Global Columns + Type-Isolated Column Pools
 *   A compact internal subformat that stores shape.global fields once as
 *   row-id-aligned global columns, followed by per-type payload dictionaries and
 *   type-local columns for shape.fields(type). Global fields are intentionally
 *   not duplicated into type-local pools or Zone 4 payload records; hydration
 *   reconstructs them by reading the global column block.
 *   Numeric and boolean channels are Float64Array-compatible blocks. String
 *   channels store [offset,length] Uint32 pairs followed by a trailing UTF-8
 *   byte block. Dictionary channels store one UTF-8 dictionary plus a Uint16
 *   code per row. Exact string channels may additionally carry a serialized
 *   value -> row ids segment.
 *
 * Zone 4: Opaque Value Blobs
 *   Back-to-back row payload records:
 *   [Uint16 lookupKeyBytes] [lookupKey UTF-8]
 *   [Uint8 fieldCount]
 *   repeated fieldCount times:
 *     [Uint8 fieldId] [Uint32 valueBytes] [MessagePack bytes]
 *
 *   Field IDs reference the per-type payload field dictionary in Zone 3. Each
 *   field value is encoded independently with msgpackr so sparse `pick()` calls
 *   can skip non-requested values by byte length and decode only selected
 *   fields.
 *
 * The literal lookupKey in Zone 4 is intentionally duplicated from Zone 2. If
 * two distinct lookup keys share a 64-bit hash, runtime lookup binary-searches
 * the matching hash range in Zone 2 and verifies the literal key in Zone 4.
 */
const MAGIC = 0x414c4e41
const VERSION = 2
const HEADER_BYTES = 64
const REGISTRY_STRUCT_BYTES = 16
const UINT8_MAX = 0xff
const UINT16_MAX = 0xffff
const UINT32_MAX = 0xffffffff
const NULL_STRING_LENGTH = 0xffffffff
const NULL_DICTIONARY_CODE = 0xffff
const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const UINT64_MASK = 0xffffffffffffffffn
const OP_KEYS = new Set([
  'is',
  'isNot',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte',
  'startsWith'
])

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const valuePackr = new Packr({useRecords: false, encodeUndefinedAsNil: true})

export const fnv1a64: HashFunction = (value: string): bigint => {
  let hash = FNV_OFFSET
  const bytes = encoder.encode(value)
  for (const byte of bytes) {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME) & UINT64_MASK
  }
  return hash
}

/**
 * ContentDB has two storage layers:
 *
 * - Staging layer: mutable records inserted with `upsert`. Every upsert drops
 *   the derivation WeakMap so parent/child relationships are recalculated on
 *   the next read without dependency graph bookkeeping.
 * - Runtime baseline: an immutable compiled ArrayBuffer parsed into Zone 2/3/4
 *   views. If a binary-backed instance receives upserts, the staging layer acts
 *   as an overlay: staged lookup keys shadow baseline rows, new rows are
 *   addressable after baseline row IDs, and `compile()` exports the merged view.
 */
export class ContentDB<
  Meta extends AnyRecord,
  Derived extends AnyRecord
> implements ContentStore<Meta, Derived> {
  readonly #shape: ContentShape<Meta, Derived>
  readonly #hash: HashFunction
  readonly #records: Array<StagedRecord<Meta>> = []
  readonly #lookupIndex = new Map<string, number>()
  #derivedCache: WeakMap<object, AnyRecord> = new WeakMap()
  #runtime?: RuntimeIndex
  #lastQueryPlan?: QueryPlanStats
  #lastPickStats?: PickStats
  #activeMaterializationStack?: Set<string>
  #filterCostCache: WeakMap<object, number> = new WeakMap()
  #andChildrenCache: WeakMap<object, Array<Filter<AnyRecord>>> = new WeakMap()
  #readers = new Map<string, (id: number) => unknown>()

  constructor(
    shape: ContentShape<Meta, Derived>,
    source?: ArrayBuffer,
    options: ContentDBOptions = {}
  ) {
    this.#shape = shape
    this.#hash = options.hash ?? fnv1a64
    if (source) this.#runtime = this.#parse(source)
  }

  upsert<Payload>(meta: Meta, payload: Payload): void {
    const lookupKey = this.#lookupKey(meta)
    const typeName = this.#shape.type(meta)
    const staged: StagedRecord<Meta> = {
      meta,
      payload:
        payload && typeof payload === 'object'
          ? {...(payload as AnyRecord)}
          : {value: payload},
      lookupKey,
      typeName
    }
    const existing = this.#lookupIndex.get(lookupKey)
    if (existing === undefined) {
      this.#lookupIndex.set(lookupKey, this.#records.length)
      this.#records.push(staged)
    } else {
      this.#records[existing] = staged
    }
    this.#derivedCache = new WeakMap()
    this.#filterCostCache = new WeakMap()
    this.#andChildrenCache = new WeakMap()
    this.#readers.clear()
  }

  get(lookupKey: string): number | undefined {
    return this.#rowIdByLookup(lookupKey)
  }

  find(
    filter: Filter<Meta & Derived>,
    options?: FindOptions
  ): Iterable<number> {
    if (this.#activeMaterializationStack) {
      return this.#runtime
        ? this.#findOverlay(
            filter as Filter<AnyRecord>,
            this.#activeMaterializationStack,
            options
          )
        : this.#findStaged(
            filter as Filter<AnyRecord>,
            this.#activeMaterializationStack,
            options
          )
    }
    if (this.#runtime && this.#records.length === 0)
      return this.#findRuntime(filter as Filter<AnyRecord>, options)
    if (this.#runtime)
      return this.#findOverlay(filter as Filter<AnyRecord>, new Set(), options)

    return this.#findStaged(filter as Filter<AnyRecord>, new Set(), options)
  }

  count(filter: Filter<Meta & Derived>, options?: FindOptions): number {
    if (this.#runtime && this.#records.length === 0)
      return this.#countRuntime(filter as Filter<AnyRecord>, options)
    return Array.from(this.find(filter, options)).length
  }

  findKeys(
    filter: Filter<Meta & Derived>,
    options?: FindOptions
  ): Iterable<string> {
    return [...this.find(filter, options)].map(id => this.#lookupKeyForId(id))
  }

  pick(
    id: number,
    fields: ReadonlyArray<string>
  ): Partial<Meta & Derived & Record<string, any>> {
    const picked: AnyRecord = {}
    const stats: PickStats = {
      hydratedFields: [],
      decodedValueCount: 0,
      skippedValueCount: 0
    }
    const stack = this.#activeMaterializationStack ?? new Set()
    for (const field of fields) {
      const value = this.#read(id, field, stack, stats)
      if (value !== undefined) picked[field] = value
    }
    stats.hydratedFields = Object.keys(picked)
    this.#lastPickStats = stats
    return picked as Partial<Meta & Derived & Record<string, any>>
  }

  read(id: number, field: string): unknown {
    return this.#read(
      id,
      field,
      this.#activeMaterializationStack ?? new Set(),
      undefined
    )
  }

  reader(field: string): (id: number) => unknown {
    const cached = this.#readers.get(field)
    if (cached) return cached
    const reader = this.#runtime && this.#records.length === 0
      ? this.#runtimeReader(field)
      : (id: number) => this.read(id, field)
    this.#readers.set(field, reader)
    return reader
  }

  pickMany(
    ids: ReadonlyArray<number>,
    fields: ReadonlyArray<string>
  ): Array<Partial<Meta & Derived & Record<string, any>>> {
    return ids.map(id => this.pick(id, fields))
  }

  hydrate(id: number): Meta & Derived & Record<string, any> {
    if (this.#runtime && this.#records.length === 0)
      return this.#hydrateRuntimeRow(id) as Meta & Derived & Record<string, any>
    if (this.#runtime)
      return this.#materializeOverlayId(id, new Set()) as Meta &
        Derived &
        Record<string, any>
    return this.#materialize(id, new Set()) as Meta &
      Derived &
      Record<string, any>
  }

  #read(
    id: number,
    field: string,
    stack: Set<string>,
    stats: PickStats | undefined
  ): unknown {
    if (this.#runtime && this.#records.length === 0)
      return this.#readRuntimeField(id, field, stats)
    if (this.#runtime) {
      const row = this.#materializeOverlayId(id, stack)
      return Object.hasOwn(row, field) ? row[field] : undefined
    }
    const row = this.#materialize(id, stack)
    return Object.hasOwn(row, field) ? row[field] : undefined
  }

  compile(): ArrayBuffer {
    if (this.#runtime && this.#records.length === 0)
      return this.#runtime.buffer.slice(0)
    if (this.#runtime) return this.#compileOverlay()

    const typeNames = [
      ...new Set(this.#records.map(record => record.typeName))
    ].sort()
    assertUint16(typeNames.length, 'Type count')
    const typeIds = new Map<string, number>()
    for (let index = 0; index < typeNames.length; index += 1) {
      typeIds.set(typeNames[index]!, index)
    }

    const nextLocal = new Map<string, number>()
    const rowCounts = new Map<string, number>()
    for (const record of this.#records) {
      rowCounts.set(record.typeName, (rowCounts.get(record.typeName) ?? 0) + 1)
    }
    for (const [typeName, count] of rowCounts) {
      assertUint16(count, `Row count for type "${typeName}"`)
    }
    const prepared: PreparedRow[] = this.#records.map((record, index) => {
      const typeId = must(
        typeIds.get(record.typeName),
        `Missing type ID for ${record.typeName}`
      )
      const localRowIndex = nextLocal.get(record.typeName) ?? 0
      assertUint16(typeId, `Type ID for "${record.typeName}"`)
      assertUint16(localRowIndex, `Local row index for "${record.lookupKey}"`)
      nextLocal.set(record.typeName, localRowIndex + 1)
      return {
        row: this.#materialize(index, new Set()),
        lookupKey: record.lookupKey,
        typeName: record.typeName,
        typeId,
        localRowIndex,
        rowId: index,
        payloadOffset: 0
      }
    })
    this.#assignRowIds(prepared)

    const {
      globalColumnKeys,
      globalDictionaryKeys,
      globalExactKeys,
      typeColumnKeysByType,
      typeDictionaryKeysByType,
      typeExactKeysByType,
      directivesByType
    } = this.#storageDirectives(typeNames)
    const payloadKeysByType = this.#payloadKeysByType(
      prepared,
      globalColumnKeys,
      typeColumnKeysByType,
      directivesByType
    )
    const zone4 = this.#writeZone4(
      prepared,
      globalColumnKeys,
      typeColumnKeysByType,
      payloadKeysByType
    )
    const zone3 = this.#writeZone3(
      prepared,
      typeNames,
      globalColumnKeys,
      globalDictionaryKeys,
      globalExactKeys,
      typeColumnKeysByType,
      typeDictionaryKeysByType,
      typeExactKeysByType,
      payloadKeysByType
    )

    const zone2Length = prepared.length * REGISTRY_STRUCT_BYTES
    const zone2Offset = HEADER_BYTES
    const zone3Offset = zone2Offset + zone2Length
    const zone3Length = zone3.byteLength
    const zone4Offset = zone3Offset + zone3Length
    const zone4Length = zone4.byteLength
    const zone2 = this.#writeZone2(prepared, zone4Offset)
    const totalLength =
      HEADER_BYTES + zone2.byteLength + zone3.byteLength + zone4.byteLength
    assertUint32(zone2Offset, 'Zone 2 offset')
    assertUint32(zone2Length, 'Zone 2 length')
    assertUint32(zone3Offset, 'Zone 3 offset')
    assertUint32(zone3Length, 'Zone 3 length')
    assertUint32(zone4Offset, 'Zone 4 offset')
    assertUint32(zone4Length, 'Zone 4 length')
    assertUint32(totalLength, 'Compiled buffer length')

    const output = new ArrayBuffer(totalLength)
    const out = new Uint8Array(output)
    const view = new DataView(output)
    view.setUint32(0, MAGIC, true)
    view.setUint32(4, VERSION, true)
    view.setUint32(8, zone2Offset, true)
    view.setUint32(12, zone2Length, true)
    view.setUint32(16, zone3Offset, true)
    view.setUint32(20, zone3Length, true)
    view.setUint32(24, zone4Offset, true)
    view.setUint32(28, zone4Length, true)
    out.set(new Uint8Array(zone2), zone2Offset)
    out.set(new Uint8Array(zone3), zone3Offset)
    out.set(new Uint8Array(zone4), zone4Offset)
    return output
  }

  getLastQueryPlan(): QueryPlanStats | undefined {
    return this.#lastQueryPlan
  }

  getLastPickStats(): PickStats | undefined {
    return this.#lastPickStats
  }

  #materialize(index: number, stack: Set<string>): AnyRecord {
    const staged = this.#records[index]
    if (!staged) throw new Error(`Invalid row ID ${index}`)

    const cached = this.#derivedCache.get(staged)
    if (cached) return cached
    const ref = `s:${index}`
    if (stack.has(ref)) {
      const cycle = [...stack, ref]
        .map(row => this.#refToLookupKey(row))
        .join(' -> ')
      throw new Error(`Circular derivation detected: ${cycle}`)
    }

    stack.add(ref)
    const base = {...staged.meta, ...staged.payload}
    const derived = this.#withMaterializationStack(stack, () =>
      this.#shape.derive(base as Meta, this)
    )
    const row = {...base, ...derived}
    this.#derivedCache.set(staged, row)
    stack.delete(ref)
    return row
  }

  #rowIdByLookup(lookupKey: string): number | undefined {
    const staged = this.#lookupIndex.get(lookupKey)
    if (!this.#runtime) return staged
    const runtimeRowId = this.#runtimeRowIdByLookup(lookupKey)
    if (runtimeRowId !== undefined) return runtimeRowId
    return staged === undefined ? undefined : this.#runtime.rowCount + staged
  }

  #materializeOverlayId(id: number, stack: Set<string>): AnyRecord {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (id < runtime.rowCount) {
      const lookupKey = this.#runtimeLookupKey(id)
      const staged = this.#lookupIndex.get(lookupKey)
      return staged === undefined
        ? this.#materializeRuntimeOverlay(id, stack)
        : this.#materialize(staged, stack)
    }
    const stagedIndex = id - runtime.rowCount
    return this.#materialize(stagedIndex, stack)
  }

  #materializeRuntimeOverlay(rowId: number, stack: Set<string>): AnyRecord {
    const entry = this.#runtimeRow(rowId)

    const staged = this.#lookupIndex.get(this.#runtimeLookupKey(rowId))
    if (staged !== undefined) return this.#materialize(staged, stack)

    const cached = this.#derivedCache.get(entry)
    if (cached) return cached
    const ref = `r:${rowId}`
    if (stack.has(ref)) {
      const cycle = [...stack, ref]
        .map(row => this.#refToLookupKey(row))
        .join(' -> ')
      throw new Error(`Circular derivation detected: ${cycle}`)
    }

    stack.add(ref)
    const base = this.#hydrateRuntimeRow(rowId)
    const derived = this.#withMaterializationStack(stack, () =>
      this.#shape.derive(base as Meta, this)
    )
    const row = {...base, ...derived}
    this.#derivedCache.set(entry, row)
    stack.delete(ref)
    return row
  }

  #findStaged(
    filter: Filter<AnyRecord>,
    stack: Set<string>,
    options?: FindOptions
  ): number[] {
    const types = options?.types ? new Set(options.types) : undefined
    const matches: number[] = []
    for (let index = 0; index < this.#records.length; index += 1) {
      const record = this.#records[index]!
      if (types && !types.has(record.typeName)) continue
      const row = this.#materialize(index, stack)
      if (matchesFilter(row, filter)) matches.push(index)
    }
    this.#lastQueryPlan = {
      fastPathFields: [],
      slowPathFields: collectTopLevelFields(filter),
      candidateCountBeforeSlow: types
        ? this.#records.filter(record => types.has(record.typeName)).length
        : this.#records.length,
      resultCount: matches.length
    }
    return matches
  }

  #findOverlay(
    filter: Filter<AnyRecord>,
    stack: Set<string> = new Set(),
    options?: FindOptions
  ): number[] {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const stagedTypes = options?.types ? new Set(options.types) : undefined
    const runtimeCandidates = this.#runtimeTypeCandidates(options?.types)
    const stats: QueryPlanStats = {
      fastPathFields: [],
      slowPathFields: [],
      candidateCountBeforeSlow:
        (runtimeCandidates?.length ?? runtime.rowCount) +
        (stagedTypes
          ? this.#records.filter(record => stagedTypes.has(record.typeName))
              .length
          : this.#records.length),
      resultCount: 0
    }
    const baselineCandidates = this.#scanRuntimeFilter(
      filter,
      runtimeCandidates,
      stats
    )
    const matches: number[] = []
    const shadowed = new Set<string>()
    for (const record of this.#records) shadowed.add(record.lookupKey)

    for (const id of baselineCandidates) {
      if (shadowed.has(this.#runtimeLookupKey(id))) continue
      if (matchesFilter(this.#materializeRuntimeOverlay(id, stack), filter))
        matches.push(id)
    }
    for (
      let stagedIndex = 0;
      stagedIndex < this.#records.length;
      stagedIndex += 1
    ) {
      const staged = this.#records[stagedIndex]!
      if (stagedTypes && !stagedTypes.has(staged.typeName)) continue
      const baselineId = this.#runtimeRowIdByLookup(staged.lookupKey)
      const id = baselineId ?? runtime.rowCount + stagedIndex
      if (matchesFilter(this.#materialize(stagedIndex, stack), filter))
        matches.push(id)
    }
    const fastFields = new Set(stats.fastPathFields)
    stats.slowPathFields = collectTopLevelFields(filter).filter(
      field => !fastFields.has(field)
    )
    stats.candidateCountBeforeSlow =
      baselineCandidates.length + this.#records.length
    const ids = [...new Set(matches)].sort((a, b) => a - b)
    stats.resultCount = ids.length
    this.#lastQueryPlan = stats
    return ids
  }

  #compileOverlay(): ArrayBuffer {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const merged = new ContentDB<Meta, Derived>(this.#shape, undefined, {
      hash: this.#hash
    })
    for (let rowId = 0; rowId < runtime.rowCount; rowId += 1) {
      if (this.#lookupIndex.has(this.#runtimeLookupKey(rowId))) continue
      const row = this.#materializeRuntimeOverlay(rowId, new Set())
      merged.upsert(row as Meta, row)
    }
    for (const record of this.#records) {
      merged.upsert(record.meta, record.payload)
    }
    return merged.compile()
  }

  #runtimeRowIdByLookup(lookupKey: string): number | undefined {
    if (!this.#runtime) return undefined
    const hash = this.#hash(lookupKey) & UINT64_MASK
    let index = lowerBoundHash(this.#runtime, hash)
    while (
      index < this.#runtime.rowCount &&
      this.#runtimeRow(index).hash === hash
    ) {
      if (this.#runtimeLookupKey(index) === lookupKey) return index
      index += 1
    }
    return undefined
  }

  #lookupKeyForId(id: number): string {
    if (this.#runtime) {
      if (id < this.#runtime.rowCount) return this.#runtimeLookupKey(id)
      const staged = this.#records[id - this.#runtime.rowCount]
      if (staged) return staged.lookupKey
      throw new Error(`Invalid row ID ${id}`)
    }
    const staged = this.#records[id]
    if (staged) return staged.lookupKey
    throw new Error(`Invalid row ID ${id}`)
  }

  #refToLookupKey(ref: string): string {
    const [kind, rawIndex] = ref.split(':')
    const index = Number(rawIndex)
    if (kind === 's') return this.#records[index]?.lookupKey ?? ref
    if (kind === 'r') return this.#runtime ? this.#runtimeLookupKey(index) : ref
    return ref
  }

  #withMaterializationStack<T>(stack: Set<string>, run: () => T): T {
    const previous = this.#activeMaterializationStack
    this.#activeMaterializationStack = stack
    try {
      return run()
    } finally {
      this.#activeMaterializationStack = previous
    }
  }

  #lookupKey(meta: Meta): string {
    const value = meta[this.#shape.lookup]
    if (typeof value !== 'string')
      throw new Error(`Lookup field "${this.#shape.lookup}" must be a string`)
    return value
  }

  #storageDirectives(typeNames: string[]): {
    globalColumnKeys: Set<string>
    globalDictionaryKeys: Set<string>
    globalExactKeys: Set<string>
    typeColumnKeysByType: Map<string, Set<string>>
    typeDictionaryKeysByType: Map<string, Set<string>>
    typeExactKeysByType: Map<string, Set<string>>
    directivesByType: Map<string, Map<string, FieldDirective>>
  } {
    const globalColumnKeys = new Set<string>()
    const globalDictionaryKeys = new Set<string>()
    const globalExactKeys = new Set<string>()
    for (const [field, directive] of Object.entries(this.#shape.global)) {
      if (field === this.#shape.lookup || directive === 'payload') continue
      globalColumnKeys.add(field)
      if (directive === 'dictionary') globalDictionaryKeys.add(field)
      if (directive === 'exact') globalExactKeys.add(field)
    }
    const typeColumnKeysByType = new Map<string, Set<string>>()
    const typeDictionaryKeysByType = new Map<string, Set<string>>()
    const typeExactKeysByType = new Map<string, Set<string>>()
    const directivesByType = new Map<string, Map<string, FieldDirective>>()
    for (const typeName of typeNames) {
      const directives = this.#fieldDirectives(typeName)
      const columns = new Set<string>()
      const dictionaries = new Set<string>()
      const exact = new Set<string>()
      for (const [field, directive] of Object.entries(
        this.#shape.fields(typeName)
      )) {
        if (field === this.#shape.lookup || directive === 'payload') continue
        columns.add(field)
        if (directive === 'dictionary') dictionaries.add(field)
        if (directive === 'exact') exact.add(field)
      }
      typeColumnKeysByType.set(typeName, columns)
      typeDictionaryKeysByType.set(typeName, dictionaries)
      typeExactKeysByType.set(typeName, exact)
      directivesByType.set(typeName, directives)
    }
    return {
      globalColumnKeys,
      globalDictionaryKeys,
      globalExactKeys,
      typeColumnKeysByType,
      typeDictionaryKeysByType,
      typeExactKeysByType,
      directivesByType
    }
  }

  #fieldDirectives(typeName: string): Map<string, FieldDirective> {
    const directives = new Map<string, FieldDirective>()
    for (const [field, directive] of Object.entries(this.#shape.global)) {
      directives.set(field, directive)
    }
    for (const [field, directive] of Object.entries(this.#shape.fields(typeName))) {
      if (directives.has(field)) {
        throw new Error(
          `Field "${field}" is declared in both global and fields(${typeName})`
        )
      }
      directives.set(field, directive)
    }
    directives.delete(this.#shape.lookup)
    return directives
  }

  #payloadKeysByType(
    prepared: PreparedRow[],
    globalColumnKeys: Set<string>,
    typeColumnKeysByType: Map<string, Set<string>>,
    directivesByType: Map<string, Map<string, FieldDirective>>
  ): Map<string, string[]> {
    const byType = new Map<string, string[]>()
    const seenByType = new Map<string, Set<string>>()
    for (const row of prepared) {
      const indexed = must(
        typeColumnKeysByType.get(row.typeName),
        `Missing index key set for ${row.typeName}`
      )
      const directives = must(
        directivesByType.get(row.typeName),
        `Missing field directives for ${row.typeName}`
      )
      const keys = byType.get(row.typeName) ?? []
      const seen = seenByType.get(row.typeName) ?? new Set<string>()
      for (const key of Object.keys(row.row)) {
        if (
          key === this.#shape.lookup ||
          globalColumnKeys.has(key) ||
          indexed.has(key) ||
          seen.has(key)
        )
          continue
        if (directives.get(key) !== 'payload')
          throw new Error(
            `Field "${key}" on type "${row.typeName}" must declare a ContentDB directive`
          )
        seen.add(key)
        keys.push(key)
      }
      byType.set(row.typeName, keys)
      seenByType.set(row.typeName, seen)
    }
    for (const [typeName, keys] of byType) {
      assertUint8(keys.length, `Payload field count for type "${typeName}"`)
    }
    return byType
  }

  #writeZone2(prepared: PreparedRow[], zone4Offset: number): ArrayBuffer {
    const entries = prepared
      .map(row => ({
        hash: this.#hash(row.lookupKey) & UINT64_MASK,
        typeId: row.typeId,
        localRowIndex: row.localRowIndex,
        payloadOffset: zone4Offset + row.payloadOffset,
        lookupKey: row.lookupKey,
        rowId: row.rowId
      }))
      .sort((a, b) => a.rowId - b.rowId)

    const buffer = new ArrayBuffer(entries.length * REGISTRY_STRUCT_BYTES)
    const view = new DataView(buffer)
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!
      const cursor = index * REGISTRY_STRUCT_BYTES
      assertUint16(entry.typeId, `Zone 2 type ID for "${entry.lookupKey}"`)
      assertUint16(
        entry.localRowIndex,
        `Zone 2 local row index for "${entry.lookupKey}"`
      )
      assertUint32(
        entry.payloadOffset,
        `Zone 2 payload offset for "${entry.lookupKey}"`
      )
      view.setBigUint64(cursor, entry.hash, true)
      view.setUint16(cursor + 8, entry.typeId, true)
      view.setUint16(cursor + 10, entry.localRowIndex, true)
      view.setUint32(cursor + 12, entry.payloadOffset, true)
    }
    return buffer
  }

  #assignRowIds(prepared: PreparedRow[]): void {
    const rows = prepared
      .map(row => ({
        hash: this.#hash(row.lookupKey) & UINT64_MASK,
        lookupKey: row.lookupKey,
        row
      }))
      .sort((a, b) =>
        compareRegistryEntries(a.hash, b.hash, a.lookupKey, b.lookupKey)
      )
    for (let rowId = 0; rowId < rows.length; rowId += 1) {
      rows[rowId]!.row.rowId = rowId
    }
  }

  #writeZone3(
    prepared: PreparedRow[],
    typeNames: string[],
    globalColumnKeys: Set<string>,
    globalDictionaryKeys: Set<string>,
    globalExactKeys: Set<string>,
    typeColumnKeysByType: Map<string, Set<string>>,
    typeDictionaryKeysByType: Map<string, Set<string>>,
    typeExactKeysByType: Map<string, Set<string>>,
    payloadKeysByType: Map<string, string[]>
  ): ArrayBuffer {
    const writer = new ByteWriter()
    writer.writeUint16(typeNames.length)
    writer.writeUint16(globalColumnKeys.size)

    const globalRows = [...prepared].sort((a, b) => a.rowId - b.rowId)
    for (const key of globalColumnKeys) {
      this.#writeColumn(
        writer,
        globalRows,
        key,
        globalDictionaryKeys,
        globalExactKeys,
        true
      )
    }

    for (let typeId = 0; typeId < typeNames.length; typeId += 1) {
      const typeName = typeNames[typeId]!
      const rows = prepared
        .filter(row => row.typeName === typeName)
        .sort((a, b) => a.localRowIndex - b.localRowIndex)
      const keys = [
        ...must(
          typeColumnKeysByType.get(typeName),
          `Missing index key set for ${typeName}`
        )
      ]
      const dictionaries = must(
        typeDictionaryKeysByType.get(typeName),
        `Missing dictionary key set for ${typeName}`
      )
      const exactStrings = must(
        typeExactKeysByType.get(typeName),
        `Missing exact key set for ${typeName}`
      )
      const payloadKeys = payloadKeysByType.get(typeName) ?? []
      assertUint16(rows.length, `Zone 3 row count for type "${typeName}"`)
      assertUint8(keys.length, `Zone 3 column count for type "${typeName}"`)
      assertUint8(
        payloadKeys.length,
        `Zone 3 payload field count for type "${typeName}"`
      )

      writer.writeUint16(typeId)
      writer.writeUint16(rows.length)
      writer.writeUint8(checkedByteLength(typeName, 'type name'))
      writer.writeBytes(encoder.encode(typeName))
      writer.writeUint8(payloadKeys.length)
      for (const key of payloadKeys) {
        writer.writeUint8(checkedByteLength(key, 'payload field key'))
        writer.writeBytes(encoder.encode(key))
      }
      writer.writeUint8(keys.length)

      for (const key of keys) {
        this.#writeColumn(writer, rows, key, dictionaries, exactStrings)
      }
    }

    return writer.toArrayBuffer()
  }

  #writeColumn(
    writer: ByteWriter,
    rows: PreparedRow[],
    key: string,
    dictionaries: Set<string>,
    exactStrings: Set<string>,
    exactOnlyStrings = false
  ): void {
    let kind = dictionaries.has(key) ? 4 : this.#columnKind(rows, key)
    if (exactOnlyStrings && exactStrings.has(key) && (kind === 1 || kind === 3)) {
      kind = 7
    } else if (exactStrings.has(key)) {
      if (kind === 1) kind = 5
      else if (kind === 3) kind = 6
    }
    writer.writeUint8(kind)
    writer.writeUint8(checkedByteLength(key, 'column key'))
    writer.writeBytes(encoder.encode(key))
    if (kind === 4) {
      this.#writeDictionaryColumn(writer, rows, key)
    } else if (kind === 7) {
      this.#writeExactStringColumn(writer, rows, key)
    } else if (kind === 1 || kind === 5) {
      this.#writeStringColumn(writer, rows, key, kind === 5)
    } else if (kind === 3 || kind === 6) {
      this.#writeHexStringColumn(writer, rows, key, kind === 6)
    } else if (kind === 2) {
      this.#writeBooleanColumn(writer, rows, key)
    } else {
      this.#writeFloatColumn(writer, rows, key)
    }
  }

  #writeExactStringColumn(
    writer: ByteWriter,
    rows: PreparedRow[],
    key: string
  ): void {
    const exactEntries: Array<{key: string; rowId: number}> = []
    for (const row of rows) {
      const value = row.row[key]
      if (value === null || value === undefined) continue
      exactEntries.push({key: String(value), rowId: row.rowId})
    }
    writeExactIndexSegment(writer, exactIndexFromEntries(exactEntries))
  }

  #columnKind(rows: PreparedRow[], key: string): ColumnKind {
    let sawString = false
    let sawNumber = false
    let sawBoolean = false
    for (const row of rows) {
      const value = row.row[key]
      if (value === null || value === undefined) continue
      if (typeof value === 'string') sawString = true
      else if (typeof value === 'number') sawNumber = true
      else if (typeof value === 'boolean') sawBoolean = true
      else throw new Error(`Indexed field "${key}" must be a primitive value`)
    }
    if (sawString && (sawNumber || sawBoolean))
      throw new Error(
        `Indexed field "${key}" mixes strings with numeric values`
      )
    if (sawString) return isPackedHexColumn(rows, key) ? 3 : 1
    if (sawBoolean && sawNumber)
      throw new Error(`Indexed field "${key}" mixes booleans with numbers`)
    return sawBoolean ? 2 : 0
  }

  #writeFloatColumn(
    writer: ByteWriter,
    rows: PreparedRow[],
    key: string
  ): void {
    writer.align(8)
    for (const row of rows) {
      const value = row.row[key]
      if (value === null || value === undefined) writer.writeFloat64(Number.NaN)
      else writer.writeFloat64(value)
    }
  }

  #writeBooleanColumn(
    writer: ByteWriter,
    rows: PreparedRow[],
    key: string
  ): void {
    const byteLength = Math.ceil(rows.length / 8)
    const present = new Uint8Array(byteLength)
    const values = new Uint8Array(byteLength)
    for (let index = 0; index < rows.length; index++) {
      const value = rows[index].row[key]
      if (value === null || value === undefined) continue
      const byte = index >> 3
      const bit = 1 << (index & 7)
      present[byte] |= bit
      if (value) values[byte] |= bit
    }
    writer.writeBytes(present)
    writer.writeBytes(values)
  }

  #writeDictionaryColumn(
    writer: ByteWriter,
    rows: PreparedRow[],
    key: string
  ): void {
    const dictionary: string[] = []
    const codes: number[] = []
    const codeByValue = new Map<string, number>()
    const exactEntries: Array<{key: string; rowId: number}> = []
    for (const row of rows) {
      const value = row.row[key]
      if (value === null || value === undefined) {
        codes.push(NULL_DICTIONARY_CODE)
        exactEntries.push({key: indexKey(null), rowId: row.rowId})
        continue
      }
      if (typeof value !== 'string')
        throw new Error(`Dictionary field "${key}" must contain strings`)
      let code = codeByValue.get(value)
      if (code === undefined) {
        code = dictionary.length
        if (code >= NULL_DICTIONARY_CODE)
          throw new Error(`Dictionary field "${key}" exceeds Uint16 codes`)
        dictionary.push(value)
        codeByValue.set(value, code)
      }
      codes.push(code)
      exactEntries.push({key: indexKey(value), rowId: row.rowId})
    }
    const exact = exactIndexFromEntries(exactEntries)
    writer.writeUint16(dictionary.length)
    for (const value of dictionary) {
      const bytes = encoder.encode(value)
      writer.writeUint16(bytes.byteLength)
      writer.writeBytes(bytes)
    }
    writer.align(2)
    for (const code of codes) writer.writeUint16(code)
    writeExactIndexSegment(writer, exact)
  }

  #writeStringColumn(
    writer: ByteWriter,
    rows: PreparedRow[],
    key: string,
    withExactIndex = false
  ): void {
    const payload = new ByteWriter()
    const pairs: Array<[number, number]> = []
    const exactEntries: Array<{key: string; rowId: number}> = []
    for (const row of rows) {
      const value = row.row[key]
      if (value === null || value === undefined) {
        pairs.push([0, NULL_STRING_LENGTH])
      } else {
        const stringValue = String(value)
        const bytes = encoder.encode(stringValue)
        pairs.push([payload.length, bytes.byteLength])
        payload.writeBytes(bytes)
        if (withExactIndex) exactEntries.push({key: stringValue, rowId: row.rowId})
      }
    }

    const bytes = payload.toUint8Array()
    writer.align(4)
    writer.writeUint32(bytes.byteLength)
    for (const [offset, length] of pairs) {
      writer.writeUint32(offset)
      writer.writeUint32(length)
    }
    writer.writeBytes(bytes)
    if (withExactIndex)
      writeExactIndexSegment(writer, exactIndexFromEntries(exactEntries))
  }

  #writeHexStringColumn(
    writer: ByteWriter,
    rows: PreparedRow[],
    key: string,
    withExactIndex = false
  ): void {
    const payload = new ByteWriter()
    const pairs: Array<[number, number]> = []
    const exactEntries: Array<{key: string; rowId: number}> = []
    for (const row of rows) {
      const value = row.row[key]
      if (value === null || value === undefined) {
        pairs.push([0, NULL_STRING_LENGTH])
      } else {
        const stringValue = String(value)
        const bytes = packHexString(stringValue)
        pairs.push([payload.length, bytes.byteLength])
        payload.writeBytes(bytes)
        if (withExactIndex) exactEntries.push({key: stringValue, rowId: row.rowId})
      }
    }

    const bytes = payload.toUint8Array()
    writer.align(4)
    writer.writeUint32(bytes.byteLength)
    for (const [offset, length] of pairs) {
      writer.writeUint32(offset)
      writer.writeUint32(length)
    }
    writer.writeBytes(bytes)
    if (withExactIndex)
      writeExactIndexSegment(writer, exactIndexFromEntries(exactEntries))
  }

  #writeZone4(
    prepared: PreparedRow[],
    globalColumnKeys: Set<string>,
    typeColumnKeysByType: Map<string, Set<string>>,
    payloadKeysByType: Map<string, string[]>
  ): ArrayBuffer {
    const writer = new ByteWriter()
    for (const row of prepared) {
      row.payloadOffset = writer.length
      const keyBytes = encoder.encode(row.lookupKey)
      if (keyBytes.byteLength > 0xffff)
        throw new Error(`lookupKey is too long: ${row.lookupKey}`)
      writer.writeUint16(keyBytes.byteLength)
      writer.writeBytes(keyBytes)

      const indexed = must(
        typeColumnKeysByType.get(row.typeName),
        `Missing index key set for ${row.typeName}`
      )
      const payloadKeys = must(
        payloadKeysByType.get(row.typeName),
        `Missing payload key set for ${row.typeName}`
      )
      const fieldIds = new Map(payloadKeys.map((key, id) => [key, id]))
      const fields = Object.keys(row.row).filter(
        key =>
          key !== this.#shape.lookup &&
          !globalColumnKeys.has(key) &&
          !indexed.has(key)
      )
      if (fields.length > 0xff)
        throw new Error(
          `Row ${row.lookupKey} has more than 255 unindexed fields`
        )
      writer.writeUint8(fields.length)
      for (const field of fields) {
        const fieldId = must(
          fieldIds.get(field),
          `Missing payload field ID for ${field}`
        )
        const valueBytes = encodeValue(row.row[field])
        writer.writeUint8(fieldId)
        writer.writeUint32(valueBytes.byteLength)
        writer.writeBytes(valueBytes)
      }
    }
    return writer.toArrayBuffer()
  }

  #parse(buffer: ArrayBuffer): RuntimeIndex {
    const view = new DataView(buffer)
    if (buffer.byteLength < HEADER_BYTES)
      throw new Error(
        'ContentDB buffer is shorter than the 64-byte master header'
      )
    if (view.getUint32(0, true) !== MAGIC)
      throw new Error('Invalid ContentDB magic bytes')
    if (view.getUint32(4, true) !== VERSION)
      throw new Error(
        `Unsupported ContentDB version ${view.getUint32(4, true)}`
      )

    const zone2Offset = view.getUint32(8, true)
    const zone2Length = view.getUint32(12, true)
    const zone3Offset = view.getUint32(16, true)
    const zone3Length = view.getUint32(20, true)
    const zone4Offset = view.getUint32(24, true)
    const zone4Length = view.getUint32(28, true)

    assertCompiledLayout(
      buffer,
      zone2Offset,
      zone2Length,
      zone3Offset,
      zone3Length,
      zone4Offset,
      zone4Length
    )
    assertRange(buffer, zone2Offset, zone2Length, 'Zone 2')
    assertRange(buffer, zone3Offset, zone3Length, 'Zone 3')
    assertRange(buffer, zone4Offset, zone4Length, 'Zone 4')
    if (zone2Length % REGISTRY_STRUCT_BYTES !== 0)
      throw new Error('Zone 2 length is not a multiple of 16 bytes')

    const rowCount = zone2Length / REGISTRY_STRUCT_BYTES
    const runtime: RuntimeIndex = {
      buffer,
      view,
      zone2Offset,
      zone2Length,
      zone3Offset,
      zone3Length,
      zone4Offset,
      zone4Length,
      rowCount,
      rows: new Map(),
      payloadValueIndexes: new Map()
    }
    this.#runtime = runtime
    return runtime
  }

  #parseZone3(
    buffer: ArrayBuffer,
    zone3Offset: number,
    zone3Length: number
  ): {
    globalColumns: RuntimeGlobalColumns
    pools: Map<number, RuntimePool>
  } {
    const view = new DataView(buffer)
    const pools = new Map<number, RuntimePool>()
    const globalColumns: RuntimeGlobalColumns = {
      rowCount: must(this.#runtime, 'Runtime index not initialized').rowCount,
      columns: new Map(),
      exactIndexes: new Map(),
      rangeIndexes: new Map()
    }
    let cursor = zone3Offset
    const end = zone3Offset + zone3Length
    if (zone3Length === 0) return {globalColumns, pools}
    ensure(cursor, 4, end, 'Zone 3 header')
    const typeCount = view.getUint16(cursor, true)
    const globalColumnCount = view.getUint16(cursor + 2, true)
    cursor += 4

    for (
      let columnIndex = 0;
      columnIndex < globalColumnCount;
      columnIndex += 1
    ) {
      const parsed = readZone3Column(
        buffer,
        cursor,
        globalColumns.rowCount,
        end
      )
      globalColumns.columns.set(parsed.key, parsed.column)
      cursor = parsed.cursor
    }

    for (let typeIndex = 0; typeIndex < typeCount; typeIndex += 1) {
      ensure(cursor, 6, end, 'Zone 3 type header')
      const typeId = view.getUint16(cursor, true)
      const rowCount = view.getUint16(cursor + 2, true)
      const nameLength = view.getUint8(cursor + 4)
      cursor += 5
      ensure(cursor, nameLength + 1, end, 'Zone 3 type name')
      const typeName = decoder.decode(
        new Uint8Array(buffer, cursor, nameLength)
      )
      cursor += nameLength
      const payloadFieldCount = view.getUint8(cursor)
      cursor += 1
      const payloadFields: string[] = []
      for (
        let fieldIndex = 0;
        fieldIndex < payloadFieldCount;
        fieldIndex += 1
      ) {
        ensure(cursor, 1, end, 'Zone 3 payload field key length')
        const keyLength = view.getUint8(cursor)
        cursor += 1
        ensure(cursor, keyLength, end, 'Zone 3 payload field key')
        payloadFields.push(
          decoder.decode(new Uint8Array(buffer, cursor, keyLength))
        )
        cursor += keyLength
      }
      ensure(cursor, 1, end, 'Zone 3 column count')
      const columnCount = view.getUint8(cursor)
      cursor += 1

      const columns = new Map<string, RuntimeColumn>()
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const parsed = readZone3Column(buffer, cursor, rowCount, end)
        columns.set(parsed.key, parsed.column)
        cursor = parsed.cursor
      }

      pools.set(typeId, {
        typeId,
        typeName,
        rowCount,
        payloadFields,
        columns,
        localRowToId: new Array<number>(rowCount),
        exactIndexes: new Map(),
        rangeIndexes: new Map()
      })
    }

    if (cursor !== end)
      throw new Error(
        'Zone 3 parser did not consume the declared boundary exactly'
      )
    return {globalColumns, pools}
  }

  #getPools(): Map<number, RuntimePool> {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (runtime.pools) return runtime.pools
    const parsed = this.#parseZone3(
      runtime.buffer,
      runtime.zone3Offset,
      runtime.zone3Length
    )
    const {pools} = parsed
    this.#populatePoolRows(pools)
    runtime.globalColumns = parsed.globalColumns
    runtime.pools = pools
    runtime.fieldToPools = this.#buildFieldToPools(pools)
    return pools
  }

  #getGlobalColumns(): RuntimeGlobalColumns {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (!runtime.globalColumns) this.#getPools()
    return must(runtime.globalColumns, 'Global columns not initialized')
  }

  #getFieldToPools(): Map<string, RuntimePool[]> {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (!runtime.fieldToPools) this.#getPools()
    return must(
      runtime.fieldToPools,
      'Runtime field-to-pool index not initialized'
    )
  }

  #buildFieldToPools(
    pools: Map<number, RuntimePool>
  ): Map<string, RuntimePool[]> {
    const fieldToPools = new Map<string, RuntimePool[]>()
    for (const pool of pools.values()) {
      for (const field of pool.columns.keys()) {
        const poolsForField = fieldToPools.get(field) ?? []
        poolsForField.push(pool)
        fieldToPools.set(field, poolsForField)
      }
    }
    return fieldToPools
  }

  #populatePoolRows(pools: Map<number, RuntimePool>): void {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    for (let rowId = 0; rowId < runtime.rowCount; rowId += 1) {
      const row = this.#runtimeRow(rowId)
      const pool = must(
        pools.get(row.typeId),
        `Missing type pool ${row.typeId}`
      )
      if (row.localRowIndex >= pool.rowCount)
        throw new Error(
          `Local row index ${row.localRowIndex} exceeds pool ${pool.typeName}`
        )
      if (pool.localRowToId[row.localRowIndex] !== undefined) {
        throw new Error(
          `Duplicate local row index ${row.localRowIndex} in pool ${pool.typeName}`
        )
      }
      pool.localRowToId[row.localRowIndex] = rowId
    }
    for (const pool of pools.values()) {
      for (
        let localRowIndex = 0;
        localRowIndex < pool.rowCount;
        localRowIndex += 1
      ) {
        if (pool.localRowToId[localRowIndex] === undefined) {
          throw new Error(
            `Zone 2 is missing local row index ${localRowIndex} for pool ${pool.typeName}`
          )
        }
      }
    }
  }

  #runtimeRow(rowId: number): RuntimeRow {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (!Number.isInteger(rowId) || rowId < 0 || rowId >= runtime.rowCount)
      throw new Error(`Invalid row ID ${rowId}`)
    const cached = runtime.rows.get(rowId)
    if (cached) return cached
    const cursor = runtime.zone2Offset + rowId * REGISTRY_STRUCT_BYTES
    const payloadOffset = runtime.view.getUint32(cursor + 12, true)
    assertZone4Offset(
      payloadOffset,
      runtime.zone4Offset,
      runtime.zone4Length,
      'Zone 2 payload offset'
    )
    const row: RuntimeRow = {
      hash: runtime.view.getBigUint64(cursor, true),
      typeId: runtime.view.getUint16(cursor + 8, true),
      localRowIndex: runtime.view.getUint16(cursor + 10, true),
      payloadOffset
    }
    runtime.rows.set(rowId, row)
    return row
  }

  #runtimeLookupKey(rowId: number): string {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const row = this.#runtimeRow(rowId)
    if (row.lookupKey !== undefined) return row.lookupKey
    row.lookupKey = readLookupKey(
      runtime.buffer,
      row.payloadOffset,
      runtime.zone4Offset + runtime.zone4Length
    )
    return row.lookupKey
  }

  #hydrateRuntimeRow(rowId: number): AnyRecord {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const entry = this.#runtimeRow(rowId)
    const row = this.#readZone4Fields(
      entry.payloadOffset,
      undefined,
      undefined,
      entry.typeId
    ).values
    row[this.#shape.lookup] = this.#runtimeLookupKey(rowId)
    for (const [field, column] of this.#getGlobalColumns().columns) {
      row[field] = readColumnValue(runtime.buffer, column, rowId)
    }
    const pool = must(
      this.#getPools().get(entry.typeId),
      `Missing type pool ${entry.typeId}`
    )
    for (const [field, column] of pool.columns) {
      row[field] = readColumnValue(runtime.buffer, column, entry.localRowIndex)
    }
    return row
  }

  #findRuntime(filter: Filter<AnyRecord>, options?: FindOptions): number[] {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const candidates = this.#runtimeTypeCandidates(options?.types)
    const stats: QueryPlanStats = {
      fastPathFields: [],
      slowPathFields: [],
      candidateCountBeforeSlow: candidates?.length ?? runtime.rowCount,
      resultCount: 0
    }
    const ids = this.#scanRuntimeFilter(filter, candidates, stats)
    stats.resultCount = ids.length
    this.#lastQueryPlan = stats
    return ids
  }

  #countRuntime(filter: Filter<AnyRecord>, options?: FindOptions): number {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const candidates = this.#runtimeTypeCandidates(options?.types)
    const stats: QueryPlanStats = {
      fastPathFields: [],
      slowPathFields: [],
      candidateCountBeforeSlow: candidates?.length ?? runtime.rowCount,
      resultCount: 0
    }
    const count = this.#countRuntimeFilter(filter, candidates, stats)
    stats.resultCount = count
    this.#lastQueryPlan = stats
    return count
  }

  #countRuntimeFilter(
    filter: Filter<AnyRecord> | undefined,
    candidates: number[] | undefined,
    stats: QueryPlanStats
  ): number {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (!filter) return candidates?.length ?? runtime.rowCount

    if (isAnd(filter)) {
      let current = candidates
      const children = this.#sortedAndChildren(filter)
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index]!
        if (index === children.length - 1)
          return this.#countRuntimeFilter(child, current, stats)
        current = this.#scanRuntimeFilter(child, current, stats)
        if (current.length === 0) return 0
      }
      return current?.length ?? runtime.rowCount
    }

    if (isOr(filter)) return this.#scanRuntimeFilter(filter, candidates, stats).length

    const entries = Object.entries(filter)
    if (entries.length === 1) {
      const [field, condition] = entries[0]!
      const before = candidates?.length ?? runtime.rowCount
      const count = this.#countRuntimeField(field, condition, candidates)
      if (this.#canColumnScan(field)) stats.fastPathFields.push(field)
      else stats.slowPathFields.push(field)
      stats.candidateCountBeforeSlow = Math.min(
        stats.candidateCountBeforeSlow,
        before
      )
      return count
    }

    return this.#scanRuntimeFilter(filter, candidates, stats).length
  }

  #countRuntimeField(
    field: string,
    condition: unknown,
    candidates: number[] | undefined
  ): number {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const nested = nestedExactRequest(field, condition)
    if (nested) {
      const indexed = this.#payloadIndexedRows(nested.path, nested.keys)
      return candidates ? intersectSortedRowCount(candidates, indexed) : indexed.length
    }
    const equality = equalityKeys(condition)
    if (equality) {
      const indexedCount = this.#exactIndexedCount(field, equality)
      if (indexedCount !== undefined) {
        if (!candidates) return indexedCount
        if (indexedCount === runtime.rowCount) return candidates.length
      }
      const indexed = this.#exactIndexedRows(field, equality)
      if (indexed)
        return candidates
          ? intersectSortedRowCount(candidates, indexed)
          : indexed.length
    }
    const range = numberRange(condition)
    if (range) {
      const indexed = this.#rangeIndexedRows(field, range)
      if (indexed)
        return candidates
          ? intersectSortedRowCount(candidates, indexed)
          : indexed.length
    }
    const primitive = primitivePredicate(condition)
    const source = candidates ?? allRowIdArray(runtime.rowCount)
    let count = 0
    for (const rowId of source) {
      const value = this.#readRuntimeField(rowId, field, undefined)
      if (primitive ? primitive(value) : matchesCondition(value, condition))
        count += 1
    }
    return count
  }

  #runtimeTypeCandidates(
    types: ReadonlyArray<string> | undefined
  ): number[] | undefined {
    if (!types) return
    if (types.length === 0) return []
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const cacheKey = types.slice().sort().join('\0')
    const cached = runtime.typeCandidates?.get(cacheKey)
    if (cached) return cached
    const wanted = new Set(types)
    const rows: number[] = []
    for (const pool of this.#getPools().values()) {
      if (!wanted.has(pool.typeName)) continue
      rows.push(...pool.localRowToId)
    }
    if (wanted.size > 1) rows.sort(compareNumbers)
    ;(runtime.typeCandidates ??= new Map()).set(cacheKey, rows)
    return rows
  }

  #scanRuntimeFilter(
    filter: Filter<AnyRecord> | undefined,
    candidates: number[] | undefined,
    stats: QueryPlanStats
  ): number[] {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (!filter) return candidates ? candidates.slice() : allRowIdArray(runtime.rowCount)

    if (isAnd(filter)) {
      let current = candidates
      const children = this.#sortedAndChildren(filter)
      for (const child of children)
        current = this.#scanRuntimeFilter(child, current, stats)
      return current ?? allRowIdArray(runtime.rowCount)
    }

    if (isOr(filter)) {
      const seen = new Uint8Array(runtime.rowCount)
      const union: number[] = []
      for (const child of filter.or) {
        if (!child) continue
        for (const id of this.#scanRuntimeFilter(child, candidates, stats)) {
          if (seen[id]) continue
          seen[id] = 1
          union.push(id)
        }
      }
      return union.sort(compareNumbers)
    }

    let current = candidates
    for (const [field, condition] of Object.entries(filter)) {
      const before = current?.length ?? runtime.rowCount
      current = this.#scanRuntimeField(field, condition, current)
      if (this.#canColumnScan(field)) stats.fastPathFields.push(field)
      else stats.slowPathFields.push(field)
      stats.candidateCountBeforeSlow = Math.min(
        stats.candidateCountBeforeSlow,
        before
      )
    }
    return current ?? allRowIdArray(runtime.rowCount)
  }

  #scanRuntimeField(
    field: string,
    condition: unknown,
    candidates: number[] | undefined
  ): number[] {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const nested = nestedExactRequest(field, condition)
    if (nested) return this.#scanNestedExactField(nested, candidates)
    const equality = equalityKeys(condition)
    if (equality) {
      if (candidates) {
        const count = this.#exactIndexedCount(field, equality)
        if (count === runtime.rowCount) return candidates
      }
      const indexed = this.#exactIndexedRows(field, equality)
      if (indexed) return candidates ? intersectSortedRows(candidates, indexed) : indexed
    }
    const range = numberRange(condition)
    if (range) {
      const indexed = this.#rangeIndexedRows(field, range)
      if (indexed) return candidates ? intersectSortedRows(candidates, indexed) : indexed
    }
    const primitive = primitivePredicate(condition)

    const globalColumn = this.#getGlobalColumns().columns.get(field)
    if (!candidates && globalColumn) {
      const matched: number[] = []
      for (let rowId = 0; rowId < runtime.rowCount; rowId += 1) {
        const value = readColumnValue(runtime.buffer, globalColumn, rowId)
        if (primitive ? !primitive(value) : !matchesCondition(value, condition))
          continue
        matched.push(rowId)
      }
      return matched
    }

    const pools = this.#getFieldToPools().get(field)
    if (!candidates && pools) {
      const matched: number[] = []
      for (const pool of pools) {
        const column = must(
          pool.columns.get(field),
          `Missing indexed column ${field}`
        )
        for (let localRowIndex = 0; localRowIndex < pool.rowCount; localRowIndex += 1) {
          const value = readColumnValue(runtime.buffer, column, localRowIndex)
          if (
            primitive
              ? !primitive(value)
              : !matchesCondition(value, condition)
          )
            continue
          const rowId = pool.localRowToId[localRowIndex]
          if (rowId !== undefined) matched.push(rowId)
        }
      }
      return matched.sort(compareNumbers)
    }

    const source = candidates ?? allRowIdArray(runtime.rowCount)
    const matched: number[] = []
    for (const rowId of source) {
      const value = this.#readRuntimeField(rowId, field, undefined)
      if (primitive ? primitive(value) : matchesCondition(value, condition))
        matched.push(rowId)
    }
    return matched
  }

  #scanFilterCost(filter: Filter<AnyRecord> | undefined): number {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (!filter) return runtime.rowCount
    const cached = this.#filterCostCache.get(filter)
    if (cached !== undefined) return cached
    let cost: number
    if (isAnd(filter))
      cost = Math.min(
        runtime.rowCount,
        ...filter.and.map(child => this.#scanFilterCost(child))
      )
    else if (isOr(filter))
      cost = filter.or.reduce(
        (sum, child) => sum + this.#scanFilterCost(child),
        0
      )
    else {
      cost = runtime.rowCount
      for (const [field, condition] of Object.entries(filter)) {
        const equality = equalityKeys(condition)
        if (equality) {
          const count = this.#exactIndexedCount(field, equality)
          if (count !== undefined) cost = Math.min(cost, count)
        }
        const range = numberRange(condition)
        if (range) {
          const count = this.#rangeIndexedCount(field, range)
          if (count !== undefined) cost = Math.min(cost, count)
        }
        const nested = nestedExactRequest(field, condition)
        if (nested) {
          const indexed = this.#payloadIndexedRows(nested.path, nested.keys)
          cost = Math.min(cost, indexed.length)
        }
      }
    }
    this.#filterCostCache.set(filter, cost)
    return cost
  }

  #sortedAndChildren(filter: AndCondition<AnyRecord>): Array<Filter<AnyRecord>> {
    const cached = this.#andChildrenCache.get(filter)
    if (cached) return cached
    const children = (filter.and.filter(Boolean) as Array<Filter<AnyRecord>>)
      .sort((left, right) => this.#scanFilterCost(left) - this.#scanFilterCost(right))
    this.#andChildrenCache.set(filter, children)
    return children
  }

  #scanNestedExactField(
    nested: {path: string; keys: string[]},
    candidates: number[] | undefined
  ): number[] {
    const indexed = this.#payloadIndexedRows(nested.path, nested.keys)
    return candidates ? intersectSortedRows(candidates, indexed) : indexed
  }

  #canColumnScan(field: string): boolean {
    return (
      this.#shape.lookup === field ||
      this.#getGlobalColumns().columns.has(field) ||
      this.#getFieldToPools().has(field)
    )
  }

  #exactIndexedRows(field: string, keys: string[]): number[] | undefined {
    if (field === this.#shape.lookup) {
      const rows: number[] = []
      for (const key of keys) {
        const value = parseIndexKey(key)
        if (typeof value !== 'string') continue
        const rowId = this.#runtimeRowIdByLookup(value)
        if (rowId !== undefined) rows.push(rowId)
      }
      return uniqueSortedRows(rows)
    }
    const globalColumns = this.#getGlobalColumns()
    if (globalColumns.columns.has(field)) {
      const rows: number[] = []
      const index = this.#columnExactIndex(globalColumns, field)
      for (const key of this.#columnExactKeys(globalColumns, field, keys))
        appendExactRows(rows, index, key)
      return uniqueSortedRows(rows)
    }
    const pools = this.#getFieldToPools().get(field)
    if (!pools) return
    const rows: number[] = []
    for (const pool of pools) {
      const index = this.#columnExactIndex(pool, field)
      for (const key of this.#columnExactKeys(pool, field, keys))
        appendExactRows(rows, index, key)
    }
    return uniqueSortedRows(rows)
  }

  #exactIndexedCount(field: string, keys: string[]): number | undefined {
    if (field === this.#shape.lookup) {
      let count = 0
      for (const key of keys) {
        const value = parseIndexKey(key)
        if (typeof value !== 'string') continue
        if (this.#runtimeRowIdByLookup(value) !== undefined) count += 1
      }
      return count
    }
    const globalColumns = this.#getGlobalColumns()
    if (globalColumns.columns.has(field)) {
      let count = 0
      const index = this.#columnExactIndex(globalColumns, field)
      for (const key of this.#columnExactKeys(globalColumns, field, keys))
        count += exactRowCount(index, key)
      return count
    }
    const pools = this.#getFieldToPools().get(field)
    if (!pools) return
    let count = 0
    for (const pool of pools) {
      const index = this.#columnExactIndex(pool, field)
      for (const key of this.#columnExactKeys(pool, field, keys))
        count += exactRowCount(index, key)
    }
    return count
  }

  #columnExactKeys(
    pool: RuntimePool | RuntimeGlobalColumns,
    field: string,
    keys: string[]
  ): string[] {
    const column = pool.columns.get(field)
    if (!column || (column.kind !== 5 && column.kind !== 6 && column.kind !== 7))
      return keys
    return keys.flatMap(key => {
      const value = parseIndexKey(key)
      return typeof value === 'string' ? [value] : []
    })
  }

  #rangeIndexedRows(
    field: string,
    range: {
      gt?: number
      gte?: number
      lt?: number
      lte?: number
    }
  ): number[] | undefined {
    const globalColumns = this.#getGlobalColumns()
    if (globalColumns.columns.has(field)) {
      const rows: number[] = []
      const index = this.#columnRangeIndex(globalColumns, field)
      const start =
        range.gt !== undefined
          ? upperNumberBound(index.values, range.gt)
          : range.gte !== undefined
            ? lowerNumberBound(index.values, range.gte)
            : 0
      const end =
        range.lt !== undefined
          ? lowerNumberBound(index.values, range.lt)
          : range.lte !== undefined
            ? upperNumberBound(index.values, range.lte)
            : index.rowIds.length
      for (let cursor = start; cursor < end; cursor += 1) {
        const rowId = index.rowIds[cursor]
        if (rowId !== undefined) rows.push(rowId)
      }
      return uniqueSortedRows(rows)
    }
    const pools = this.#getFieldToPools().get(field)
    if (!pools) return
    const rows: number[] = []
    for (const pool of pools) {
      const index = this.#columnRangeIndex(pool, field)
      const start =
        range.gt !== undefined
          ? upperNumberBound(index.values, range.gt)
          : range.gte !== undefined
            ? lowerNumberBound(index.values, range.gte)
            : 0
      const end =
        range.lt !== undefined
          ? lowerNumberBound(index.values, range.lt)
          : range.lte !== undefined
            ? upperNumberBound(index.values, range.lte)
            : index.rowIds.length
      for (let cursor = start; cursor < end; cursor += 1) {
        const rowId = index.rowIds[cursor]
        if (rowId !== undefined) rows.push(rowId)
      }
    }
    return uniqueSortedRows(rows)
  }

  #rangeIndexedCount(
    field: string,
    range: {
      gt?: number
      gte?: number
      lt?: number
      lte?: number
    }
  ): number | undefined {
    const globalColumns = this.#getGlobalColumns()
    if (globalColumns.columns.has(field)) {
      const index = this.#columnRangeIndex(globalColumns, field)
      const start =
        range.gt !== undefined
          ? upperNumberBound(index.values, range.gt)
          : range.gte !== undefined
            ? lowerNumberBound(index.values, range.gte)
            : 0
      const end =
        range.lt !== undefined
          ? lowerNumberBound(index.values, range.lt)
          : range.lte !== undefined
            ? upperNumberBound(index.values, range.lte)
            : index.rowIds.length
      return Math.max(0, end - start)
    }
    const pools = this.#getFieldToPools().get(field)
    if (!pools) return
    let count = 0
    for (const pool of pools) {
      const index = this.#columnRangeIndex(pool, field)
      const start =
        range.gt !== undefined
          ? upperNumberBound(index.values, range.gt)
          : range.gte !== undefined
            ? lowerNumberBound(index.values, range.gte)
            : 0
      const end =
        range.lt !== undefined
          ? lowerNumberBound(index.values, range.lt)
          : range.lte !== undefined
            ? upperNumberBound(index.values, range.lte)
            : index.rowIds.length
      count += Math.max(0, end - start)
    }
    return count
  }

  #payloadIndexedRows(path: string, keys: string[]): number[] {
    const index = this.#payloadValueIndex(path)
    const rows: number[] = []
    for (const key of keys) appendExactRows(rows, index, key)
    return uniqueSortedRows(rows)
  }

  #columnExactIndex(
    pool: RuntimePool | RuntimeGlobalColumns,
    field: string
  ): RuntimeExactIndex {
    const cached = pool.exactIndexes.get(field)
    if (cached) return cached
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const column = must(
      pool.columns.get(field),
      `Missing indexed column ${field}`
    )
    if (column.kind === 4) {
      pool.exactIndexes.set(field, column.exact)
      return column.exact
    }
    if (
      (column.kind === 5 || column.kind === 6 || column.kind === 7) &&
      column.exact
    ) {
      pool.exactIndexes.set(field, column.exact)
      return column.exact
    }
    const entries: Array<{key: string; rowId: number}> = []
    for (
      let localRowIndex = 0;
      localRowIndex < pool.rowCount;
      localRowIndex += 1
    ) {
      const rowId = columnSourceRowId(pool, localRowIndex)
      if (rowId === undefined) continue
      const value = readColumnValue(runtime.buffer, column, localRowIndex)
      if (!isPrimitiveValue(value)) continue
      const key = indexKey(value)
      entries.push({key, rowId})
    }
    const index = exactIndexFromEntries(entries)
    pool.exactIndexes.set(field, index)
    return index
  }

  #columnRangeIndex(
    pool: RuntimePool | RuntimeGlobalColumns,
    field: string
  ): RuntimeRangeIndex {
    const cached = pool.rangeIndexes.get(field)
    if (cached) return cached
    const column = must(
      pool.columns.get(field),
      `Missing indexed column ${field}`
    )
    const entries: Array<{value: number; rowId: number}> = []
    if (column.kind === 0) {
      for (
        let localRowIndex = 0;
        localRowIndex < pool.rowCount;
        localRowIndex += 1
      ) {
        const rowId = columnSourceRowId(pool, localRowIndex)
        const value = column.values[localRowIndex]
        if (
          rowId === undefined ||
          value === undefined ||
          Number.isNaN(value)
        )
          continue
        entries.push({value, rowId})
      }
    }
    entries.sort((left, right) => left.value - right.value || left.rowId - right.rowId)
    const index = {
      values: entries.map(entry => entry.value),
      rowIds: entries.map(entry => entry.rowId)
    }
    pool.rangeIndexes.set(field, index)
    return index
  }

  #readRuntimeField(
    rowId: number,
    field: string,
    stats: PickStats | undefined
  ): unknown {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (field === this.#shape.lookup) {
      if (stats) stats.hydratedFields.push(field)
      return this.#runtimeLookupKey(rowId)
    }
    const globalColumn = this.#getGlobalColumns().columns.get(field)
    if (globalColumn) {
      if (stats) stats.hydratedFields.push(field)
      return readColumnValue(runtime.buffer, globalColumn, rowId)
    }
    const entry = this.#runtimeRow(rowId)
    const pool = must(
      this.#getPools().get(entry.typeId),
      `Missing type pool ${entry.typeId}`
    )
    const existingColumn = pool.columns.get(field)
    if (existingColumn) {
      if (stats) stats.hydratedFields.push(field)
      return readColumnValue(
        runtime.buffer,
        existingColumn,
        entry.localRowIndex
      )
    }

    const cached = entry.values?.get(field)
    if (cached !== undefined) return cached
    const zone4 = this.#readZone4Fields(
      entry.payloadOffset,
      new Set([field]),
      stats,
      entry.typeId
    ).values
    if (Object.hasOwn(zone4, field)) {
      ;(entry.values ??= new Map()).set(field, zone4[field])
      return zone4[field]
    }
    return undefined
  }

  #runtimeReader(field: string): (id: number) => unknown {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    if (field === this.#shape.lookup)
      return id => this.#runtimeLookupKey(id)
    const globalColumn = this.#getGlobalColumns().columns.get(field)
    if (globalColumn)
      return id => readColumnValue(runtime.buffer, globalColumn, id)
    const pools = this.#getPools()
    if (this.#getFieldToPools().has(field))
      return id => {
        const entry = this.#runtimeRow(id)
        const pool = must(
          pools.get(entry.typeId),
          `Missing type pool ${entry.typeId}`
        )
        const column = pool.columns.get(field)
        return column
          ? readColumnValue(runtime.buffer, column, entry.localRowIndex)
          : undefined
      }
    return id => this.#readRuntimeField(id, field, undefined)
  }

  #payloadValueIndex(path: string): RuntimeExactIndex {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const cached = runtime.payloadValueIndexes.get(path)
    if (cached) return cached
    const entries: Array<{key: string; rowId: number}> = []
    const [field, ...tail] = path.split('.')
    for (let rowId = 0; rowId < runtime.rowCount; rowId += 1) {
      const value = this.#readRuntimeField(rowId, field!, undefined)
      for (const item of valuesAtPath(value, tail)) {
        if (!isPrimitiveValue(item)) continue
        const key = indexKey(item)
        entries.push({key, rowId})
      }
    }
    const index = exactIndexFromEntries(entries)
    runtime.payloadValueIndexes.set(path, index)
    return index
  }

  #readZone4Fields(
    payloadOffset: number,
    requested: Set<string> | undefined,
    stats: PickStats | undefined,
    typeId: number
  ): {lookupKey: string; values: AnyRecord} {
    const runtime = must(this.#runtime, 'Runtime index not initialized')
    const pool = must(
      this.#getPools().get(typeId),
      `Missing type pool ${typeId}`
    )
    const end = runtime.zone4Offset + runtime.zone4Length
    let cursor = payloadOffset
    ensure(cursor, 2, end, 'Zone 4 lookup key length')
    const lookupLength = runtime.view.getUint16(cursor, true)
    cursor += 2
    ensure(cursor, lookupLength + 1, end, 'Zone 4 lookup key')
    const lookupKey = decoder.decode(
      new Uint8Array(runtime.buffer, cursor, lookupLength)
    )
    cursor += lookupLength
    const fieldCount = runtime.view.getUint8(cursor)
    cursor += 1
    const values: AnyRecord = {}

    for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
      ensure(cursor, 5, end, 'Zone 4 field header')
      const fieldId = runtime.view.getUint8(cursor)
      cursor += 1
      const key = pool.payloadFields[fieldId]
      if (key === undefined)
        throw new Error(`Invalid Zone 4 field id ${fieldId}`)
      const valueLength = runtime.view.getUint32(cursor, true)
      cursor += 4
      ensure(cursor, valueLength, end, 'Zone 4 value payload')
      if (!requested || requested.has(key)) {
        values[key] = decodeValue(runtime.buffer, cursor, valueLength)
        if (stats) {
          stats.decodedValueCount += 1
          stats.hydratedFields.push(key)
        }
      } else if (stats) {
        stats.skippedValueCount += 1
      }
      cursor += valueLength
    }
    return {lookupKey, values}
  }
}

class ByteWriter {
  #buffer = new Uint8Array(256)
  #view = new DataView(this.#buffer.buffer)
  length = 0

  writeUint8(value: number): void {
    this.#ensure(1)
    assertUint8(value, 'Uint8 value')
    this.#view.setUint8(this.length, value)
    this.length += 1
  }

  writeUint16(value: number): void {
    this.#ensure(2)
    assertUint16(value, 'Uint16 value')
    this.#view.setUint16(this.length, value, true)
    this.length += 2
  }

  writeUint32(value: number): void {
    this.#ensure(4)
    assertUint32(value, 'Uint32 value')
    this.#view.setUint32(this.length, value, true)
    this.length += 4
  }

  writeFloat64(value: number): void {
    this.#ensure(8)
    this.#view.setFloat64(this.length, value, true)
    this.length += 8
  }

  writeBytes(bytes: Uint8Array): void {
    this.#ensure(bytes.byteLength)
    this.#buffer.set(bytes, this.length)
    this.length += bytes.byteLength
  }

  align(boundary: number): void {
    while (this.length % boundary !== 0) this.writeUint8(0)
  }

  toUint8Array(): Uint8Array {
    return this.#buffer.slice(0, this.length)
  }

  toArrayBuffer(): ArrayBuffer {
    const bytes = this.toUint8Array()
    const output = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(output).set(bytes)
    return output
  }

  #ensure(size: number): void {
    const required = this.length + size
    if (required <= this.#buffer.byteLength) return
    let next = this.#buffer.byteLength
    while (next < required) next *= 2
    const expanded = new Uint8Array(next)
    expanded.set(this.#buffer)
    this.#buffer = expanded
    this.#view = new DataView(this.#buffer.buffer)
  }
}

function writeExactIndexSegment(
  writer: ByteWriter,
  exact: RuntimeExactIndex
): void {
  writer.align(4)
  writer.writeUint16(exact.keys.length)
  for (const value of exact.keys) {
    const bytes = encoder.encode(value)
    writer.writeUint16(bytes.byteLength)
    writer.writeBytes(bytes)
  }
  writer.align(4)
  writer.writeUint32(exact.rowIds.length)
  for (let index = 0; index < exact.starts.length; index += 1) {
    writer.writeUint32(exact.starts[index]!)
  }
  for (let index = 0; index < exact.rowIds.length; index += 1) {
    writer.writeUint32(exact.rowIds[index]!)
  }
}

function compareRegistryEntries(
  left: bigint,
  right: bigint,
  leftKey: string,
  rightKey: string
): number {
  if (left < right) return -1
  if (left > right) return 1
  return leftKey.localeCompare(rightKey)
}

function readColumnValue(
  buffer: ArrayBuffer,
  column: RuntimeColumn,
  localRowIndex: number
): Primitive {
  if (column.kind === 0) {
    const value = column.values[localRowIndex]
    return value === undefined || Number.isNaN(value) ? null : value
  }
  if (column.kind === 2) {
    const byte = localRowIndex >> 3
    const bit = 1 << (localRowIndex & 7)
    return column.present[byte] & bit
      ? Boolean(column.values[byte] & bit)
      : null
  }
  if (column.kind === 4) {
    const code = column.values[localRowIndex]
    if (code === undefined || code === NULL_DICTIONARY_CODE) return null
    return column.dictionary[code] ?? null
  }
  if (column.kind === 7) {
    if (!column.reverse) {
      const reverse: Array<string | undefined> = []
      for (let keyIndex = 0; keyIndex < column.exact.keys.length; keyIndex += 1) {
        const key = column.exact.keys[keyIndex]!
        const start = column.exact.starts[keyIndex]!
        const end = column.exact.starts[keyIndex + 1]!
        for (let cursor = start; cursor < end; cursor += 1) {
          const rowId = column.exact.rowIds[cursor]
          if (rowId !== undefined) reverse[rowId] = key
        }
      }
      column.reverse = reverse
    }
    return column.reverse[localRowIndex] ?? null
  }
  const offset = column.pairs[localRowIndex * 2]
  const length = column.pairs[localRowIndex * 2 + 1]
  if (column.cache && column.cache[localRowIndex] !== undefined)
    return column.cache[localRowIndex]!
  if (
    offset === undefined ||
    length === undefined ||
    length === NULL_STRING_LENGTH
  )
    return null
  if (offset + length > column.bytesLength)
    throw new Error('String column offset exceeds its byte block')
  const bytes = new Uint8Array(buffer, column.bytesStart + offset, length)
  const value =
    column.kind === 3 || column.kind === 6
      ? unpackHexString(bytes)
      : decoder.decode(bytes)
  ;(column.cache ??= [])[localRowIndex] = value
  return value
}

function columnSourceRowId(
  source: RuntimePool | RuntimeGlobalColumns,
  localRowIndex: number
): number | undefined {
  return 'localRowToId' in source
    ? source.localRowToId[localRowIndex]
    : localRowIndex
}

function readLookupKey(
  buffer: ArrayBuffer,
  payloadOffset: number,
  end: number = buffer.byteLength
): string {
  ensure(payloadOffset, 2, end, 'Zone 4 lookup key length')
  const view = new DataView(buffer)
  const length = view.getUint16(payloadOffset, true)
  ensure(payloadOffset + 2, length, end, 'Zone 4 lookup key')
  return decoder.decode(new Uint8Array(buffer, payloadOffset + 2, length))
}

function isPackedHexColumn(rows: PreparedRow[], key: string): boolean {
  let found = false
  for (const row of rows) {
    const value = row.row[key]
    if (value === null || value === undefined) continue
    if (typeof value !== 'string' || !isLowerHexString(value)) return false
    found = true
  }
  return found
}

function isLowerHexString(value: string): boolean {
  return value.length > 0 && value.length % 2 === 0 && /^[\da-f]+$/.test(value)
}

function packHexString(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

const hexAlphabet = '0123456789abcdef'

function unpackHexString(bytes: Uint8Array): string {
  let value = ''
  for (const byte of bytes) {
    value += hexAlphabet[byte >> 4]!
    value += hexAlphabet[byte & 0x0f]!
  }
  return value
}

function encodeValue(value: unknown): Uint8Array {
  return valuePackr.pack(value)
}

export function encodeContentDBValue(value: unknown): Uint8Array {
  return encodeValue(value)
}

export function decodeContentDBValue(
  buffer: ArrayBuffer,
  offset: number,
  length: number
): unknown {
  return decodeValue(buffer, offset, length)
}

function decodeValue(
  buffer: ArrayBuffer,
  offset: number,
  length: number
): unknown {
  ensure(offset, length, buffer.byteLength, 'ContentDB value payload')
  if (length === 0) throw new Error('ContentDB value payload is empty')
  return valuePackr.unpack(new Uint8Array(buffer, offset, length))
}

function checkedByteLength(value: string, label: string): number {
  const length = encoder.encode(value).byteLength
  assertUint8(length, label)
  return length
}

function assertUint8(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > UINT8_MAX) {
    throw new Error(`${label} exceeds Uint8 bounds: ${value}`)
  }
}

function assertUint16(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > UINT16_MAX) {
    throw new Error(`${label} exceeds Uint16 bounds: ${value}`)
  }
}

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new Error(`${label} exceeds Uint32 bounds: ${value}`)
  }
}

function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

function assertRange(
  buffer: ArrayBuffer,
  offset: number,
  length: number,
  label: string
): void {
  if (offset < 0 || length < 0 || offset + length > buffer.byteLength) {
    throw new Error(`${label} points outside the ContentDB buffer`)
  }
}

function assertCompiledLayout(
  buffer: ArrayBuffer,
  zone2Offset: number,
  zone2Length: number,
  zone3Offset: number,
  zone3Length: number,
  zone4Offset: number,
  zone4Length: number
): void {
  if (zone2Offset !== HEADER_BYTES)
    throw new Error('Zone 2 must start immediately after the 64-byte header')
  if (zone3Offset !== zone2Offset + zone2Length)
    throw new Error('Zone 3 must start immediately after Zone 2')
  if (zone4Offset !== zone3Offset + zone3Length)
    throw new Error('Zone 4 must start immediately after Zone 3')
  if (zone4Offset + zone4Length !== buffer.byteLength)
    throw new Error('Zone 4 must end at the buffer boundary')
}

function assertZone4Offset(
  payloadOffset: number,
  zone4Offset: number,
  zone4Length: number,
  label: string
): void {
  if (
    payloadOffset < zone4Offset ||
    payloadOffset >= zone4Offset + zone4Length
  ) {
    throw new Error(`${label} points outside Zone 4`)
  }
}

function ensure(
  cursor: number,
  length: number,
  end: number,
  label: string
): void {
  if (cursor + length > end)
    throw new Error(`${label} exceeds its declared zone boundary`)
}

function align(offset: number, boundary: number): number {
  return Math.ceil(offset / boundary) * boundary
}

function readExactIndexSegment(
  buffer: ArrayBuffer,
  cursor: number,
  end: number,
  label: string
): {exact: RuntimeExactIndex; cursor: number} {
  const view = new DataView(buffer)
  cursor = align(cursor, 4)
  ensure(cursor, 2, end, `${label} key count`)
  const keyCount = view.getUint16(cursor, true)
  cursor += 2
  const keys: string[] = []
  for (let itemIndex = 0; itemIndex < keyCount; itemIndex += 1) {
    ensure(cursor, 2, end, `${label} key length`)
    const byteLength = view.getUint16(cursor, true)
    cursor += 2
    ensure(cursor, byteLength, end, `${label} key`)
    keys.push(decoder.decode(new Uint8Array(buffer, cursor, byteLength)))
    cursor += byteLength
  }
  cursor = align(cursor, 4)
  ensure(cursor, 4, end, `${label} row count`)
  const rowIdCount = view.getUint32(cursor, true)
  cursor += 4
  ensure(
    cursor,
    (keyCount + 1) * 4 + rowIdCount * 4,
    end,
    `${label} rows`
  )
  const starts = new Uint32Array(buffer, cursor, keyCount + 1)
  cursor += (keyCount + 1) * 4
  const rowIds = new Uint32Array(buffer, cursor, rowIdCount)
  cursor += rowIdCount * 4
  return {exact: {keys, starts, rowIds}, cursor}
}

function readZone3Column(
  buffer: ArrayBuffer,
  cursor: number,
  rowCount: number,
  end: number
): {key: string; column: RuntimeColumn; cursor: number} {
  const view = new DataView(buffer)
  ensure(cursor, 2, end, 'Zone 3 column header')
  const kind = view.getUint8(cursor) as ColumnKind
  const keyLength = view.getUint8(cursor + 1)
  cursor += 2
  ensure(cursor, keyLength, end, 'Zone 3 column key')
  const key = decoder.decode(new Uint8Array(buffer, cursor, keyLength))
  cursor += keyLength

  if (kind === 1 || kind === 3 || kind === 5 || kind === 6) {
    cursor = align(cursor, 4)
    ensure(cursor, 4, end, 'Zone 3 string block length')
    const bytesLength = view.getUint32(cursor, true)
    cursor += 4
    ensure(cursor, rowCount * 8 + bytesLength, end, 'Zone 3 string column')
    const pairs = new Uint32Array(buffer, cursor, rowCount * 2)
    cursor += rowCount * 8
    const bytesStart = cursor
    cursor += bytesLength
    let exact: RuntimeExactIndex | undefined
    if (kind === 5 || kind === 6) {
      const parsed = readExactIndexSegment(
        buffer,
        cursor,
        end,
        'Zone 3 string exact index'
      )
      exact = parsed.exact
      cursor = parsed.cursor
    }
    return {key, column: {kind, pairs, bytesStart, bytesLength, exact}, cursor}
  }

  if (kind === 4) {
    ensure(cursor, 2, end, 'Zone 3 dictionary size')
    const dictionaryCount = view.getUint16(cursor, true)
    cursor += 2
    const dictionary: string[] = []
    for (let itemIndex = 0; itemIndex < dictionaryCount; itemIndex += 1) {
      ensure(cursor, 2, end, 'Zone 3 dictionary item length')
      const byteLength = view.getUint16(cursor, true)
      cursor += 2
      ensure(cursor, byteLength, end, 'Zone 3 dictionary item')
      dictionary.push(decoder.decode(new Uint8Array(buffer, cursor, byteLength)))
      cursor += byteLength
    }
    cursor = align(cursor, 2)
    ensure(cursor, rowCount * 2, end, 'Zone 3 dictionary codes')
    const values = new Uint16Array(buffer, cursor, rowCount)
    cursor += rowCount * 2
    const parsed = readExactIndexSegment(
      buffer,
      cursor,
      end,
      'Zone 3 dictionary exact index'
    )
    cursor = parsed.cursor
    return {
      key,
      column: {kind, values, dictionary, exact: parsed.exact},
      cursor
    }
  }

  if (kind === 7) {
    const parsed = readExactIndexSegment(
      buffer,
      cursor,
      end,
      'Zone 3 exact string column'
    )
    return {key, column: {kind, exact: parsed.exact}, cursor: parsed.cursor}
  }

  if (kind === 0) {
    cursor = align(cursor, 8)
    ensure(cursor, rowCount * 8, end, 'Zone 3 numeric column')
    const values = new Float64Array(buffer, cursor, rowCount)
    cursor += rowCount * 8
    return {key, column: {kind, values}, cursor}
  }

  if (kind === 2) {
    const byteLength = Math.ceil(rowCount / 8)
    ensure(cursor, byteLength * 2, end, 'Zone 3 boolean column')
    const column: RuntimeColumn = {
      kind,
      present: new Uint8Array(buffer, cursor, byteLength),
      values: new Uint8Array(buffer, cursor + byteLength, byteLength)
    }
    cursor += byteLength * 2
    return {key, column, cursor}
  }

  throw new Error(`Unknown Zone 3 column kind ${kind}`)
}

function lowerBoundHash(runtime: RuntimeIndex, hash: bigint): number {
  let low = 0
  let high = runtime.rowCount
  while (low < high) {
    const mid = (low + high) >> 1
    const midHash = runtime.view.getBigUint64(
      runtime.zone2Offset + mid * REGISTRY_STRUCT_BYTES,
      true
    )
    if (midHash < hash) low = mid + 1
    else high = mid
  }
  return low
}

function allRowIdArray(count: number): number[] {
  const ids = new Array<number>(count)
  for (let id = 0; id < count; id += 1) ids[id] = id
  return ids
}

function compareNumbers(left: number, right: number): number {
  return left - right
}

function intersectSortedRows(left: number[], right: number[]): number[] {
  let matched: number[] | undefined
  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftId = left[leftIndex]!
    const rightId = right[rightIndex]!
    if (leftId === rightId) {
      if (matched) matched.push(leftId)
      leftIndex += 1
      rightIndex += 1
    } else if (leftId < rightId) {
      matched ??= left.slice(0, leftIndex)
      leftIndex += 1
    } else {
      matched ??= left.slice(0, leftIndex)
      rightIndex += 1
    }
  }
  if (!matched && leftIndex === left.length) return left
  matched ??= left.slice(0, leftIndex)
  return matched
}

function intersectSortedRowCount(left: number[], right: number[]): number {
  let count = 0
  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftId = left[leftIndex]!
    const rightId = right[rightIndex]!
    if (leftId === rightId) {
      count += 1
      leftIndex += 1
      rightIndex += 1
    } else if (leftId < rightId) {
      leftIndex += 1
    } else {
      rightIndex += 1
    }
  }
  return count
}

function uniqueSortedRows(rows: number[]): number[] {
  if (rows.length < 2) return rows
  rows.sort(compareNumbers)
  let write = 1
  for (let read = 1; read < rows.length; read += 1) {
    if (rows[read] === rows[write - 1]) continue
    rows[write] = rows[read]!
    write += 1
  }
  rows.length = write
  return rows
}

function exactIndexFromEntries(
  entries: Array<{key: string; rowId: number}>
): RuntimeExactIndex {
  entries.sort(
    (left, right) =>
      left.key.localeCompare(right.key) || left.rowId - right.rowId
  )
  const keys: string[] = []
  const starts: number[] = [0]
  const rowIds: number[] = []
  let lastKey: string | undefined
  let lastRowId = -1
  for (const entry of entries) {
    if (entry.key === lastKey && entry.rowId === lastRowId) continue
    if (entry.key !== lastKey) {
      if (lastKey !== undefined) starts.push(rowIds.length)
      keys.push(entry.key)
      lastKey = entry.key
    }
    rowIds.push(entry.rowId)
    lastRowId = entry.rowId
  }
  starts.push(rowIds.length)
  return {keys, starts: Uint32Array.from(starts), rowIds}
}

function appendExactRows(
  output: number[],
  index: RuntimeExactIndex,
  key: string
): void {
  const keyIndex = lowerStringBound(index.keys, key)
  if (index.keys[keyIndex] !== key) return
  const start = index.starts[keyIndex]!
  const end = index.starts[keyIndex + 1]!
  for (let cursor = start; cursor < end; cursor += 1) {
    const rowId = index.rowIds[cursor]
    if (rowId !== undefined) output.push(rowId)
  }
}

function exactRowCount(index: RuntimeExactIndex, key: string): number {
  const keyIndex = lowerStringBound(index.keys, key)
  if (index.keys[keyIndex] !== key) return 0
  return index.starts[keyIndex + 1]! - index.starts[keyIndex]!
}

function lowerStringBound(values: string[], target: string): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (values[mid]! < target) low = mid + 1
    else high = mid
  }
  return low
}

function isAnd(value: unknown): value is AndCondition<AnyRecord> {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as AndCondition<AnyRecord>).and)
  )
}

function isOr(value: unknown): value is OrCondition<AnyRecord> {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as OrCondition<AnyRecord>).or)
  )
}

function isPrimitiveValue(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isOpsObject(value: unknown): value is Ops {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value).some(key => OP_KEYS.has(key))
}

function matchesFilter(
  row: unknown,
  filter: Filter<AnyRecord> | undefined
): boolean {
  if (!filter) return true
  if (isAnd(filter))
    return filter.and.every(child => !child || matchesFilter(row, child))
  if (isOr(filter))
    return filter.or.some(child => !!child && matchesFilter(row, child))
  if (!row || typeof row !== 'object') return false
  for (const [field, condition] of Object.entries(filter)) {
    if (!matchesCondition((row as AnyRecord)[field], condition)) return false
  }
  return true
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (isOpsObject(condition)) return matchesOps(value, condition)
  if (!condition || typeof condition !== 'object' || Array.isArray(condition))
    return deepEqual(value, condition)
  const objectCondition = condition as AnyRecord
  if (Object.hasOwn(objectCondition, 'has'))
    return matchesFilter(value, objectCondition.has)
  if (Object.hasOwn(objectCondition, 'includes')) {
    if (!Array.isArray(value)) return false
    return value.some(item => matchesFilter(item, objectCondition.includes))
  }
  return matchesFilter(value, objectCondition as Filter<AnyRecord>)
}

function matchesOps(value: unknown, ops: Ops): boolean {
  if (Object.hasOwn(ops, 'is') && !deepEqual(value, ops.is)) return false
  if (Object.hasOwn(ops, 'isNot') && deepEqual(value, ops.isNot)) return false
  if (ops.in && !ops.in.some(item => deepEqual(value, item))) return false
  if (ops.notIn && ops.notIn.some(item => deepEqual(value, item))) return false
  if (Object.hasOwn(ops, 'gt') && !(compareValues(value, ops.gt) > 0))
    return false
  if (Object.hasOwn(ops, 'gte') && !(compareValues(value, ops.gte) >= 0))
    return false
  if (Object.hasOwn(ops, 'lt') && !(compareValues(value, ops.lt) < 0))
    return false
  if (Object.hasOwn(ops, 'lte') && !(compareValues(value, ops.lte) <= 0))
    return false
  if (
    ops.startsWith !== undefined &&
    (typeof value !== 'string' || !value.startsWith(ops.startsWith))
  )
    return false
  return true
}

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'string' && typeof right === 'string')
    return left.localeCompare(right)
  if (typeof left === 'boolean' && typeof right === 'boolean')
    return Number(left) - Number(right)
  return Number.NaN
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right) return false
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
    return false
  return JSON.stringify(left) === JSON.stringify(right)
}

function indexKey(value: Primitive): string {
  return `${typeof value}:${JSON.stringify(value)}`
}

function parseIndexKey(key: string): Primitive | undefined {
  const separator = key.indexOf(':')
  if (separator === -1) return
  const type = key.slice(0, separator)
  const encoded = key.slice(separator + 1)
  if (type === 'string') return JSON.parse(encoded) as string
  if (type === 'number') return JSON.parse(encoded) as number
  if (type === 'boolean') return JSON.parse(encoded) as boolean
  if (type === 'object') return null
}

function equalityKeys(condition: unknown): string[] | undefined {
  if (isOpsObject(condition)) {
    if (Object.hasOwn(condition, 'is') && isPrimitiveValue(condition.is))
      return [indexKey(condition.is)]
    if (condition.in && condition.in.every(isPrimitiveValue))
      return condition.in.map(value => indexKey(value as Primitive))
    return undefined
  }
  return isPrimitiveValue(condition) ? [indexKey(condition)] : undefined
}

function primitivePredicate(
  condition: unknown
): ((value: unknown) => boolean) | undefined {
  if (isOpsObject(condition)) {
    const ops = condition
    const equals =
      Object.hasOwn(ops, 'is') && isPrimitiveValue(ops.is)
        ? ops.is
        : undefined
    const notEquals =
      Object.hasOwn(ops, 'isNot') && isPrimitiveValue(ops.isNot)
        ? ops.isNot
        : undefined
    const inValues = ops.in?.filter(isPrimitiveValue)
    const notInValues = ops.notIn?.filter(isPrimitiveValue)
    const gt = typeof ops.gt === 'number' ? ops.gt : undefined
    const gte = typeof ops.gte === 'number' ? ops.gte : undefined
    const lt = typeof ops.lt === 'number' ? ops.lt : undefined
    const lte = typeof ops.lte === 'number' ? ops.lte : undefined
    const startsWith = ops.startsWith
    return value => {
      if (equals !== undefined && value !== equals) return false
      if (notEquals !== undefined && value === notEquals) return false
      if (inValues && !inValues.includes(value as Primitive)) return false
      if (notInValues && notInValues.includes(value as Primitive)) return false
      if (gt !== undefined && !(typeof value === 'number' && value > gt))
        return false
      if (gte !== undefined && !(typeof value === 'number' && value >= gte))
        return false
      if (lt !== undefined && !(typeof value === 'number' && value < lt))
        return false
      if (lte !== undefined && !(typeof value === 'number' && value <= lte))
        return false
      if (
        startsWith !== undefined &&
        !(typeof value === 'string' && value.startsWith(startsWith))
      )
        return false
      return true
    }
  }
  if (isPrimitiveValue(condition)) return value => value === condition
}

function nestedExactRequest(
  field: string,
  condition: unknown
): {path: string; keys: string[]} | undefined {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition))
    return
  const input = condition as AnyRecord
  if (Object.hasOwn(input, 'has'))
    return nestedExactFilter(field, input.has as Filter<AnyRecord>)
  if (Object.hasOwn(input, 'includes'))
    return nestedExactFilter(field, input.includes as Filter<AnyRecord>)
}

function nestedExactFilter(
  prefix: string,
  filter: Filter<AnyRecord> | undefined
): {path: string; keys: string[]} | undefined {
  if (!filter || isAnd(filter) || isOr(filter)) return
  const entries = Object.entries(filter)
  if (entries.length !== 1) return
  const [field, condition] = entries[0]!
  const keys = equalityKeys(condition)
  if (keys) return {path: `${prefix}.${field}`, keys}
  return nestedExactRequest(`${prefix}.${field}`, condition)
}

function valuesAtPath(value: unknown, path: string[]): unknown[] {
  if (path.length === 0) return [value]
  if (Array.isArray(value))
    return value.flatMap(item => valuesAtPath(item, path))
  if (!value || typeof value !== 'object') return []
  const [field, ...tail] = path
  return valuesAtPath((value as AnyRecord)[field!], tail)
}

function numberRange(condition: unknown):
  | {
      gt?: number
      gte?: number
      lt?: number
      lte?: number
    }
  | undefined {
  if (!isOpsObject(condition)) return undefined
  const range = {
    gt: typeof condition.gt === 'number' ? condition.gt : undefined,
    gte: typeof condition.gte === 'number' ? condition.gte : undefined,
    lt: typeof condition.lt === 'number' ? condition.lt : undefined,
    lte: typeof condition.lte === 'number' ? condition.lte : undefined
  }
  return range.gt === undefined &&
    range.gte === undefined &&
    range.lt === undefined &&
    range.lte === undefined
    ? undefined
    : range
}

function lowerNumberBound(values: number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (values[mid]! < target) low = mid + 1
    else high = mid
  }
  return low
}

function upperNumberBound(values: number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (values[mid]! <= target) low = mid + 1
    else high = mid
  }
  return low
}

function collectTopLevelFields(filter: Filter<AnyRecord>): string[] {
  if (isAnd(filter))
    return filter.and.flatMap(child =>
      child ? collectTopLevelFields(child) : []
    )
  if (isOr(filter))
    return filter.or.flatMap(child =>
      child ? collectTopLevelFields(child) : []
    )
  return Object.keys(filter)
}
