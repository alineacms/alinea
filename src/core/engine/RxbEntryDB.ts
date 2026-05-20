import type {Config} from '../Config.js'
import type {AnyQueryResult, GraphQuery} from '../Graph.js'
import {Graph} from '../Graph.js'
import {createRecord} from '../EntryRecord.js'
import type {Policy} from '../Role.js'
import {sourceChanges} from '../db/CommitRequest.js'
import {EntryIndex} from '../db/EntryIndex.js'
import {EntryTransaction} from '../db/EntryTransaction.js'
import type {Mutation} from '../db/Mutation.js'
import {MemorySource} from '../source/MemorySource.js'
import type {RemoteSource} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {
  createRxbEntryArtifact,
  compressRxbEntryBytes,
  decodeRxbEntryArtifact,
  decompressRxbEntryBytes,
  encodeRxbEntryArtifact,
  hydrateRxbEntryRowAt,
  type RxbEntryArtifact,
  type RxbEntryRow
} from './RxbEntryArtifact.js'
import {RxbEntryEngine} from './RxbEntryEngine.js'

export interface RxbEntryRollback {
  artifact: RxbEntryArtifact
  bytes?: Uint8Array
}

export interface RxbEntryApplyResult {
  sha: string
  rollback: RxbEntryRollback
}

export interface RxbEntryDBOptions {
  entryCacheSize?: number
  leafCacheSize?: number
  planCacheSize?: number
  rowCacheSize?: number
}

export class RxbEntryDB extends Graph {
  readonly #options: RxbEntryDBOptions
  #artifact: RxbEntryArtifact
  #engine: RxbEntryEngine
  #bytes: Uint8Array | undefined

  constructor(
    public config: Config,
    bytes: Uint8Array,
    options: RxbEntryDBOptions = {}
  ) {
    super()
    this.#options = options
    this.#artifact = decodeRxbEntryArtifact(bytes)
    this.#engine = this.#createEngine(this.#artifact, bytes)
    this.#bytes = bytes
  }

  static open(
    config: Config,
    bytes: Uint8Array,
    options?: RxbEntryDBOptions
  ): RxbEntryDB {
    return new RxbEntryDB(config, bytes, options)
  }

  static async openCompressed(
    config: Config,
    encoded: string,
    options?: RxbEntryDBOptions
  ): Promise<RxbEntryDB> {
    return new RxbEntryDB(
      config,
      await decompressRxbEntryBytes(encoded),
      options
    )
  }

  static fromArtifact(
    config: Config,
    artifact: RxbEntryArtifact,
    options?: RxbEntryDBOptions
  ): RxbEntryDB {
    return new RxbEntryDB(config, encodeRxbEntryArtifact(artifact), options)
  }

  get sha(): string {
    return this.#artifact.meta.graphSha
  }

  get graphSha(): string {
    return this.#artifact.meta.graphSha
  }

  get artifact(): RxbEntryArtifact {
    return this.#artifact
  }

  get bytes(): Uint8Array {
    return this.exportBytes()
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.#engine.query({
      query
    }) as Promise<AnyQueryResult<Query>>
  }

  async mutations(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<RxbEntryApplyResult> {
    const rollback = this.checkpoint()
    const next = await applyMutationsToArtifact(
      this.config,
      this.#artifact,
      mutations,
      options
    )
    this.#replace(next)
    return {sha: this.sha, rollback}
  }

  async applyLocal(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<RxbEntryApplyResult> {
    return this.mutations(mutations, options)
  }

  async syncWith(remote: RemoteSource): Promise<string> {
    const next = await syncArtifactWithRemote(this.config, this.#artifact, remote)
    this.#replace(next)
    return this.sha
  }

  checkpoint(): RxbEntryRollback {
    return {
      artifact: this.#artifact,
      bytes: this.#bytes
    }
  }

  rollback(checkpoint: RxbEntryRollback): string {
    this.#replace(checkpoint.artifact, checkpoint.bytes)
    return this.sha
  }

  exportBytes(): Uint8Array {
    return (this.#bytes ??= encodeRxbEntryArtifact(this.#artifact))
  }

  exportCompressedBytes(): Promise<string> {
    return compressRxbEntryBytes(this.exportBytes())
  }

  #replace(artifact: RxbEntryArtifact, bytes?: Uint8Array) {
    bytes ??= encodeRxbEntryArtifact(artifact)
    this.#artifact = artifact
    this.#engine = this.#createEngine(artifact, bytes)
    this.#bytes = bytes
  }

  #createEngine(
    artifact: RxbEntryArtifact,
    bytes?: Uint8Array
  ): RxbEntryEngine {
    return new RxbEntryEngine({
      config: this.config,
      artifact,
      bytes,
      entryCacheSize: this.#options.entryCacheSize,
      leafCacheSize: this.#options.leafCacheSize,
      planCacheSize: this.#options.planCacheSize,
      rowCacheSize: this.#options.rowCacheSize
    })
  }
}

function createSourceFromArtifact(
  config: Config,
  artifact: RxbEntryArtifact,
  tree = ReadonlyTree.fromFlat(artifact.payload.tree),
  extraBlobs = new Map<string, Uint8Array>()
): MemorySource {
  const blobs = new Map<string, Uint8Array>()
  const fileHashes = new Map(tree.index())
  const rowIds = artifact.payload.columns.rowIds
  for (let ordinal = 0; ordinal < rowIds.length; ordinal++) {
    const rowId = rowIds[ordinal]
    const row = hydrateRxbEntryRowAt(
      config,
      artifact.payload,
      ordinal,
      fileHashes.get(rowId)
    )
    if (!row) continue
    blobs.set(row.fileHash, encodeRxbEntryRow(row))
  }
  for (const [sha, blob] of extraBlobs) blobs.set(sha, blob)
  return new MemorySource(tree, blobs)
}

async function applyMutationsToArtifact(
  config: Config,
  artifact: RxbEntryArtifact,
  mutations: Array<Mutation>,
  options: {policy?: Policy} = {}
): Promise<RxbEntryArtifact> {
  const source = createSourceFromArtifact(config, artifact)
  const index = new EntryIndex(config)
  await index.syncWith(source)
  const from = await source.getTree()
  const tx = new EntryTransaction(config, index, source, from, options.policy)
  tx.apply(mutations)
  const request = await tx.toRequest()
  const batch = sourceChanges(request)
  if (batch.changes.length) {
    await index.indexChanges(batch)
    await source.applyChanges(batch)
  }
  return createRxbEntryArtifact(config, index, {
    configHash: artifact.meta.configHash,
    contentHash: index.sha
  })
}

async function syncArtifactWithRemote(
  config: Config,
  artifact: RxbEntryArtifact,
  remote: RemoteSource
): Promise<RxbEntryArtifact> {
  const localTree = ReadonlyTree.fromFlat(artifact.payload.tree)
  const remoteTree = await remote.getTreeIfDifferent(localTree.sha)
  if (!remoteTree) return artifact

  const batch = localTree.diff(remoteTree)
  const missingShas = Array.from(
    new Set(
      batch.changes
        .filter(change => change.op === 'add')
        .map(change => change.sha)
    )
  )
  const blobs = new Map<string, Uint8Array>()
  for await (const [sha, blob] of remote.getBlobs(missingShas)) {
    blobs.set(sha, blob)
  }

  const source = createSourceFromArtifact(config, artifact, remoteTree, blobs)
  const index = new EntryIndex(config)
  await index.syncWith(source)
  return createRxbEntryArtifact(config, index, {
    configHash: artifact.meta.configHash,
    contentHash: index.sha
  })
}

function encodeRxbEntryRow(row: RxbEntryRow): Uint8Array {
  const record = createRecord(
    {
      id: row.id,
      type: row.type,
      index: row.index,
      root: row.root,
      path: row.path,
      title: row.title,
      seeded: row.seeded,
      data: row.data,
      parentId: row.parentId
    },
    row.versionStatus ?? row.status
  )
  return new TextEncoder().encode(JSON.stringify(record, null, 2))
}
