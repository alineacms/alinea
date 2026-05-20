import type {Config} from '../Config.js'
import type {AnyQueryResult, GraphQuery} from '../Graph.js'
import {Graph} from '../Graph.js'
import type {Policy} from '../Role.js'
import type {Mutation} from '../db/Mutation.js'
import type {RemoteSource} from '../source/Source.js'
import type {EntrySnapshot} from './EntrySnapshot.js'
import {
  createRxbEntryArtifact,
  decodeRxbEntryArtifact,
  encodeRxbEntryArtifact,
  type RxbEntryArtifact
} from './RxbEntryArtifact.js'
import {
  applyRxbEntryMutations,
  syncRxbEntryArtifact
} from './RxbEntryArtifactSource.js'
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
    this.#engine = this.#createEngine(this.#artifact)
    this.#bytes = bytes
  }

  static open(
    config: Config,
    bytes: Uint8Array,
    options?: RxbEntryDBOptions
  ): RxbEntryDB {
    return new RxbEntryDB(config, bytes, options)
  }

  static fromArtifact(
    config: Config,
    artifact: RxbEntryArtifact,
    options?: RxbEntryDBOptions
  ): RxbEntryDB {
    return new RxbEntryDB(config, encodeRxbEntryArtifact(artifact), options)
  }

  static fromSnapshot(
    config: Config,
    snapshot: EntrySnapshot,
    options?: RxbEntryDBOptions
  ): RxbEntryDB {
    return RxbEntryDB.fromArtifact(
      config,
      createRxbEntryArtifact(snapshot),
      options
    )
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

  async applyLocal(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<RxbEntryApplyResult> {
    const rollback = this.checkpoint()
    const next = await applyRxbEntryMutations(
      this.config,
      this.#artifact,
      mutations,
      options
    )
    this.#replace(next)
    return {sha: this.sha, rollback}
  }

  async applyMutations(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<RxbEntryApplyResult> {
    return this.applyLocal(mutations, options)
  }

  async syncWith(remote: RemoteSource): Promise<string> {
    const next = await syncRxbEntryArtifact(this.config, this.#artifact, remote)
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

  #replace(artifact: RxbEntryArtifact, bytes?: Uint8Array) {
    this.#artifact = artifact
    this.#engine = this.#createEngine(artifact)
    this.#bytes = bytes
  }

  #createEngine(artifact: RxbEntryArtifact): RxbEntryEngine {
    return new RxbEntryEngine({
      artifact,
      entryCacheSize: this.#options.entryCacheSize,
      leafCacheSize: this.#options.leafCacheSize,
      planCacheSize: this.#options.planCacheSize,
      rowCacheSize: this.#options.rowCacheSize
    })
  }
}
