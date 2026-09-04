import type {Config} from '#/core/Config.js'
import {compareStrings} from '#/core/source/Utils.js'
import {assert} from '#/core/util/Assert.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {
  MemoryRangeSource,
  type ByteRangeSource,
  type ByteRangeSourceFactory
} from '../replica/Bundle.js'
import type {
  RuntimeDatabaseIndex,
  RuntimeDevelopmentCheckpoint,
  RuntimeIndexEntry,
  RuntimeSourceIndex
} from './Model.js'
import {RuntimeEntryStore} from './Store.js'

export type RuntimeEntryChange =
  | {
      op: 'set'
      entry: RuntimeIndexEntry
      /** Internal context used to filter access transitions. */
      previous?: RuntimeIndexEntry
    }
  | {
      op: 'remove'
      id: string
      entryId: string
      /** Internal context used to filter tombstones before replica transfer. */
      previous?: RuntimeIndexEntry
    }

/** A minimal logical transition between two complete runtime snapshots. */
export interface RuntimeDelta {
  fromRevision: string
  toRevision: string
  bundleId: string
  bundleUrl: string
  entries: ReadonlyArray<RuntimeEntryChange>
  /** Undefined keeps the previous value; null removes it. */
  source?: RuntimeSourceIndex | null
  /** Undefined keeps the previous value; null removes it. */
  development?: RuntimeDevelopmentCheckpoint | null
}

export interface RuntimeDeltaArtifact {
  delta: RuntimeDelta
  bundle: Uint8Array
}

interface RuntimeBundle {
  url: string
  source: ByteRangeSource
  contents: Uint8Array
}

/** Resolves every physical bundle referenced by one logical snapshot. */
export class RuntimeBundleCatalog {
  #fallback: ByteRangeSourceFactory
  #bundles: ReadonlyMap<string, RuntimeBundle> = new Map()
  #urls: ReadonlyMap<string, ByteRangeSource> = new Map()

  constructor(fallback: ByteRangeSourceFactory) {
    this.#fallback = fallback
  }

  source = (url: string): ByteRangeSource =>
    this.#urls.get(url) ?? this.#fallback(url)

  contents(bundleId: string): Uint8Array | undefined {
    return this.#bundles.get(bundleId)?.contents
  }

  withArtifact(
    artifact: RuntimeDeltaArtifact,
    index: RuntimeDatabaseIndex,
    retainedBundleLimit: number
  ): RuntimeBundleCatalog {
    const contents = artifact.bundle.slice()
    const bundles = new Map(this.#bundles)
    bundles.delete(artifact.delta.bundleId)
    bundles.set(artifact.delta.bundleId, {
      url: artifact.delta.bundleUrl,
      source: new MemoryRangeSource(contents),
      contents
    })
    const live = runtimeBundleIds(index)
    const retired = [...bundles.keys()].filter(id => !live.has(id))
    while (retired.length > retainedBundleLimit)
      bundles.delete(retired.shift()!)
    const next = new RuntimeBundleCatalog(this.#fallback)
    next.#bundles = bundles
    next.#urls = new Map(
      [...bundles.values()].map(bundle => [bundle.url, bundle.source])
    )
    return next
  }
}

export interface ApplyRuntimeDeltaOptions {
  /** Retain recent unreferenced bytes for remote readers of an older snapshot. */
  retainedBundleLimit?: number
}

/** One directly queryable revision. Reads never traverse a snapshot chain. */
export class RuntimeSnapshot {
  readonly index: RuntimeDatabaseIndex
  readonly store: RuntimeEntryStore
  readonly resolver: DatabaseResolver
  readonly bundles: RuntimeBundleCatalog
  #config: Config

  constructor(
    config: Config,
    index: RuntimeDatabaseIndex,
    store: RuntimeEntryStore,
    bundles = new RuntimeBundleCatalog(url => store.rangeSource(url))
  ) {
    assert(
      index.revision === store.revision,
      `Runtime snapshot index ${index.revision} does not match store ${store.revision}`
    )
    this.#config = config
    this.index = index
    this.store = store
    this.bundles = bundles
    this.resolver = new DatabaseResolver(config, store)
  }

  static open(
    config: Config,
    index: RuntimeDatabaseIndex,
    source: ByteRangeSourceFactory
  ): RuntimeSnapshot {
    const bundles = new RuntimeBundleCatalog(source)
    return new RuntimeSnapshot(
      config,
      index,
      new RuntimeEntryStore({index, source: bundles.source}),
      bundles
    )
  }

  apply(
    artifact: RuntimeDeltaArtifact,
    options: ApplyRuntimeDeltaOptions = {}
  ): RuntimeSnapshot {
    const index = applyRuntimeDelta(this.index, artifact.delta)
    const bundles = this.bundles.withArtifact(
      artifact,
      index,
      options.retainedBundleLimit ?? 0
    )
    return new RuntimeSnapshot(
      this.#config,
      index,
      this.store.fork(index, bundles.source),
      bundles
    )
  }

  replace(
    index: RuntimeDatabaseIndex,
    source: ByteRangeSourceFactory
  ): RuntimeSnapshot {
    const bundles = new RuntimeBundleCatalog(source)
    return new RuntimeSnapshot(
      this.#config,
      index,
      this.store.fork(index, bundles.source),
      bundles
    )
  }
}

export function createRuntimeDelta(
  previous: RuntimeDatabaseIndex,
  next: RuntimeDatabaseIndex,
  bundleId: string,
  bundleUrl: string
): RuntimeDelta {
  assert(
    previous.revision !== next.revision,
    'Runtime delta must change the revision'
  )
  const before = new Map(previous.entries.map(entry => [entry.id, entry]))
  const entries: Array<RuntimeEntryChange> = []
  for (const entry of next.entries) {
    const current = before.get(entry.id)
    before.delete(entry.id)
    if (!current || !runtimeEntryEqual(current, entry))
      entries.push({op: 'set', entry, previous: current})
  }
  for (const entry of before.values())
    entries.push({
      op: 'remove',
      id: entry.id,
      entryId: entry.entryId,
      previous: entry
    })
  return {
    fromRevision: previous.revision,
    toRevision: next.revision,
    bundleId,
    bundleUrl,
    entries,
    source: metadataChange(previous.source, next.source),
    development: metadataChange(previous.development, next.development)
  }
}

export function applyRuntimeDelta(
  snapshot: RuntimeDatabaseIndex,
  delta: RuntimeDelta
): RuntimeDatabaseIndex {
  if (snapshot.revision !== delta.fromRevision)
    throw new Error(
      `Runtime delta starts at ${delta.fromRevision}, expected ${snapshot.revision}`
    )
  const entries = new Map(snapshot.entries.map(entry => [entry.id, entry]))
  for (const change of delta.entries) {
    if (change.op === 'set') entries.set(change.entry.id, change.entry)
    else entries.delete(change.id)
  }
  return {
    ...snapshot,
    revision: delta.toRevision,
    entries: [...entries.values()].sort(compareRuntimeEntries),
    source: applyMetadata(snapshot.source, delta.source),
    development: applyMetadata(snapshot.development, delta.development)
  }
}

export function runtimeDeltaEntryIds(delta: RuntimeDelta): ReadonlySet<string> {
  return new Set(
    delta.entries.map(change =>
      change.op === 'set' ? change.entry.entryId : change.entryId
    )
  )
}

export function runtimeBundleIds(
  index: RuntimeDatabaseIndex
): ReadonlySet<string> {
  const result = new Set<string>()
  for (const entry of index.entries)
    for (const frame of [
      entry.frames?.data,
      entry.frames?.search,
      entry.frames?.references
    ])
      if (frame?.bundleId) result.add(frame.bundleId)
  const sourceFrame = index.source?.treeFrame.frame
  if (sourceFrame?.bundleId) result.add(sourceFrame.bundleId)
  return result
}

function runtimeEntryEqual(
  left: RuntimeIndexEntry,
  right: RuntimeIndexEntry
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function compareRuntimeEntries(
  left: RuntimeIndexEntry,
  right: RuntimeIndexEntry
): number {
  return (
    compareStrings(left.index, right.index) ||
    compareStrings(left.locale ?? '', right.locale ?? '') ||
    statusOrder(left.versionStatus) - statusOrder(right.versionStatus)
  )
}

function statusOrder(status: RuntimeIndexEntry['versionStatus']): number {
  switch (status) {
    case 'draft':
      return 0
    case 'published':
      return 1
    case 'archived':
      return 2
  }
}

function metadataChange<Value>(
  previous: Value | undefined,
  next: Value | undefined
): Value | null | undefined {
  if (previous === next) return
  if (next === undefined) return null
  return next
}

function applyMetadata<Value>(
  previous: Value | undefined,
  change: Value | null | undefined
): Value | undefined {
  if (change === undefined) return previous
  return change ?? undefined
}
