import type {Config} from '../Config.js'
import type {AnyQueryResult, GraphQuery} from '../Graph.js'
import type {UploadResponse} from '../Connection.js'
import type {SyncApi} from '../Connection.js'
import type {Policy} from '../Role.js'
import type {Source} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {accumulate} from '../util/Async.js'
import {assert} from '../util/Assert.js'
import {IndexEvent} from '../db/IndexEvent.js'
import type {Mutation} from '../db/Mutation.js'
import {WriteableGraph} from '../db/WriteableGraph.js'
import {
  createRxbEntryArtifactFromBlobs,
  encodeRxbEntryArtifact,
  type RxbEntryArtifact
} from './RxbEntryArtifact.js'
import {
  RxbEntryDB,
  type RxbEntryApplyResult,
  type RxbEntryDBOptions,
  type RxbEntryRollback
} from './RxbEntryDB.js'

export interface RxbLocalDBOptions extends RxbEntryDBOptions {
  bytes?: Uint8Array
  source?: Source
}

export class RxbLocalDB extends WriteableGraph {
  readonly index = new RxbEntryIndexEvents()
  readonly #options: RxbEntryDBOptions
  readonly #source: Source | undefined
  #db: RxbEntryDB | undefined
  #opening: Promise<RxbEntryDB> | undefined

  constructor(
    public config: Config,
    input?: Source | Uint8Array | RxbLocalDBOptions,
    options: RxbEntryDBOptions = {}
  ) {
    super()
    if (input instanceof Uint8Array) {
      this.#options = options
      this.#db = RxbEntryDB.open(config, input, options)
      this.index.replace(this.#db.tree)
    } else if (isRxbLocalDBOptions(input)) {
      this.#options = {
        entryCacheSize: input.entryCacheSize,
        leafCacheSize: input.leafCacheSize,
        planCacheSize: input.planCacheSize,
        rowCacheSize: input.rowCacheSize
      }
      this.#source = input.source
      if (input.bytes) {
        this.#db = RxbEntryDB.open(config, input.bytes, this.#options)
        this.index.replace(this.#db.tree)
      }
    } else {
      this.#options = options
      this.#source = input
    }
  }

  static async fromSource(
    config: Config,
    source: SyncApi,
    options?: RxbEntryDBOptions
  ): Promise<RxbLocalDB> {
    const artifact = await createRxbEntryArtifactFromSource(config, source)
    return new RxbLocalDB(config, encodeRxbEntryArtifact(artifact), options)
  }

  static open(
    config: Config,
    bytes: Uint8Array,
    options?: RxbEntryDBOptions
  ): RxbLocalDB {
    return new RxbLocalDB(config, bytes, options)
  }

  get sha(): string {
    return this.#db?.sha ?? this.index.tree.sha
  }

  get graphSha(): string {
    return this.sha
  }

  get bytes(): Uint8Array {
    return this.exportBytes()
  }

  get artifact(): RxbEntryArtifact {
    const db = this.#db
    assert(db, 'RXB local DB has not been loaded yet')
    return db.artifact
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return (await this.#ready()).resolve(query)
  }

  async mutate(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<{sha: string; rollback: RxbEntryRollback}> {
    const result = await this.mutations(mutations, options)
    return {sha: result.sha, rollback: result.rollback}
  }

  async mutations(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<RxbEntryApplyResult> {
    const result = await (await this.#ready()).mutations(mutations, options)
    this.#replace(await this.#ready())
    return result
  }

  async applyLocal(
    mutations: Array<Mutation>,
    options: {policy?: Policy} = {}
  ): Promise<RxbEntryApplyResult> {
    return this.mutations(mutations, options)
  }

  async sync(): Promise<string> {
    const db = await this.#ready()
    if (this.#source) await db.syncWith(this.#source)
    this.#replace(db)
    return db.sha
  }

  async syncWith(remote: SyncApi): Promise<string> {
    const db = await this.#ready()
    const sha = await db.syncWith(remote)
    this.#replace(db)
    return sha
  }

  checkpoint(): RxbEntryRollback {
    const db = this.#db
    assert(db, 'RXB local DB has not been loaded yet')
    return db.checkpoint()
  }

  rollback(checkpoint: RxbEntryRollback): string {
    const db = this.#db
    assert(db, 'RXB local DB has not been loaded yet')
    const sha = db.rollback(checkpoint)
    this.#replace(db)
    return sha
  }

  exportBytes(): Uint8Array {
    const db = this.#db
    assert(db, 'RXB local DB has not been loaded yet')
    return db.exportBytes()
  }

  exportCompressedBytes(): Promise<string> {
    const db = this.#db
    assert(db, 'RXB local DB has not been loaded yet')
    return db.exportCompressedBytes()
  }

  getTreeIfDifferent(sha: string) {
    return this.index.tree.sha === sha
      ? Promise.resolve(undefined)
      : Promise.resolve(this.index.tree)
  }

  async *getBlobs(shas: Array<string>) {
    if (!this.#source)
      throw new Error('RXB local DB does not retain source blobs')
    yield* this.#source.getBlobs(shas)
  }

  async prepareUpload(_file: string): Promise<UploadResponse> {
    throw new Error('Uploads not supported on RXB local DB')
  }

  async #ready(): Promise<RxbEntryDB> {
    if (this.#db) return this.#db
    if (this.#opening) return this.#opening
    assert(this.#source, 'RXB local DB requires bytes or a source')
    this.#opening = createRxbEntryArtifactFromSource(
      this.config,
      this.#source
    ).then(artifact => {
      const db = RxbEntryDB.fromArtifact(this.config, artifact, this.#options)
      this.#replace(db)
      return db
    })
    return this.#opening
  }

  #replace(db: RxbEntryDB) {
    this.#db = db
    this.index.replace(db.tree)
    this.index.dispatchEvent(new IndexEvent({op: 'index', sha: db.sha}))
  }
}

export class RxbEntryIndexEvents extends EventTarget {
  tree = ReadonlyTree.EMPTY

  get sha(): string {
    return this.tree.sha
  }

  replace(tree: ReadonlyTree) {
    this.tree = tree
  }
}

export async function createRxbEntryArtifactFromSource(
  config: Config,
  source: SyncApi,
  baseSha = ReadonlyTree.EMPTY.sha
): Promise<RxbEntryArtifact> {
  const tree = (await source.getTreeIfDifferent(baseSha)) ?? ReadonlyTree.EMPTY
  const shas = Array.from(new Set(tree.index().values()))
  const blobs = new Map(await accumulate(source.getBlobs(shas)))
  for (const sha of shas) assert(blobs.has(sha), `Missing source blob: ${sha}`)
  return createRxbEntryArtifactFromBlobs(config, tree, blobs)
}

function isRxbLocalDBOptions(
  input: Source | Uint8Array | RxbLocalDBOptions | undefined
): input is RxbLocalDBOptions {
  return Boolean(
    input &&
      !(input instanceof Uint8Array) &&
      ('bytes' in input || 'source' in input)
  )
}
