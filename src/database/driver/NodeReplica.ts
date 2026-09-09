import type {Config} from '#/core/Config.js'
import {
  applyPreview,
  decodePreviewRequest
} from '#/backend/resolver/ParsePreview.js'
import type {DecodedEntryPreview} from '#/backend/resolver/ParsePreview.js'
import {Graph, type GraphQuery, type AnyQueryResult} from '#/core/Graph.js'
import {Policy} from '#/core/Role.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {isRecord} from '#/core/util/Objects.js'
import {randomUUID} from 'node:crypto'
import {constants} from 'node:fs'
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import {join, resolve as resolvePath} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {sqlMutationRequest} from '../handler/SqlMutationRequest.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {openCheckpoint, type CheckpointIdentity} from '../runtime/Checkpoint.js'
import type {EntryRuntime, QueryObserver} from '../runtime/EntryRuntime.js'
import {reconcileDatabase} from '../runtime/ReconcileDatabase.js'
import {entryReferencesTo} from '../runtime/EntryReferences.js'
import {fixDatabase} from '../runtime/FixDatabase.js'
import {normalizeEntryPreview} from '../runtime/NormalizePreview.js'
import {nodeDatabase} from './NodeDatabase.js'
import {NodeOverlay} from './NodeOverlay.js'

interface Snapshot {
  path: string
  identity: CheckpointIdentity
  revision: string
  runtime: EntryRuntime
  sqlite: DatabaseSync
  readers: number
  retired: boolean
}

export interface NodeReplicaOptions {
  config: Config
  /** Private cache directory; never an application's public directory. */
  directory: string
  identity: CheckpointIdentity
}

export interface CheckpointCapture {
  identity: CheckpointIdentity
  revision: string
}

export interface CheckpointSource {
  captureCheckpoint(destination: string): Promise<CheckpointCapture>
}

const identityKeys = [
  'project',
  'namespace',
  'epoch',
  'schemaId',
  'configId',
  'releaseId'
] as const
const generationPattern = /^checkpoint-[a-f0-9-]{36}\.sqlite$/

/** Node working-copy baseline. Published files are immutable; queries lease a
 * read-only connection across all async projection stages. The disk pointer is
 * a restart cache, not an authoritative mutation store or cross-process lock.
 */
export class NodeReplica extends Graph {
  #options: NodeReplicaOptions
  #current?: Snapshot
  #updates: Promise<unknown> = Promise.resolve()
  #closed = false
  #listeners = new Set<() => void>()

  private constructor(options: NodeReplicaOptions) {
    super()
    this.#options = {
      ...options,
      directory: resolvePath(options.directory),
      identity: {...options.identity}
    }
  }

  get config(): Config {
    return this.#options.config
  }

  static async open(
    options: NodeReplicaOptions,
    source: RemoteSource | {checkpoint: string}
  ): Promise<NodeReplica> {
    const replica = new NodeReplica(options)
    const {directory, identity: expected} = replica.#options
    await mkdir(directory, {recursive: true, mode: 0o700})
    try {
      let pointer: unknown
      try {
        pointer = JSON.parse(
          await readFile(join(directory, 'current.json'), 'utf8')
        )
      } catch (error) {
        if (!isRecord(error) || error.code !== 'ENOENT') throw error
      }
      if (pointer !== undefined) {
        if (
          !isRecord(pointer) ||
          typeof pointer.file !== 'string' ||
          !generationPattern.test(pointer.file) ||
          !isRecord(pointer.identity)
        )
          throw new Error('Invalid SQLite replica cache pointer')
        const identity = pointer.identity
        if (
          !identityKeys.every(
            key => typeof identity[key] === 'string' && identity[key].length > 0
          )
        )
          throw new Error('Invalid SQLite replica cache identity')
        // Dev restarts may retain a release. Packaged baselines additionally
        // bind cache reuse to the deployment release, not just its schema/scope.
        if (
          identityKeys.every(
            key =>
              (!('checkpoint' in source) && key === 'releaseId') ||
              identity[key] === expected[key]
          )
        )
          replica.#current = await replica.#openSnapshot(
            join(directory, pointer.file),
            identity as unknown as CheckpointIdentity
          )
      }
      if (!replica.#current) {
        if ('checkpoint' in source)
          replica.#current = await replica.#openSnapshot(
            resolvePath(source.checkpoint),
            expected
          )
        else await replica.sync(source)
      }
      return replica
    } catch (error) {
      await replica.close()
      throw error
    }
  }

  get revision(): string {
    if (this.#closed || !this.#current)
      throw new Error('SQLite replica is closed or not ready')
    return this.#current.revision
  }

  async #openSnapshot(
    path: string,
    identity: CheckpointIdentity
  ): Promise<Snapshot> {
    const sqlite = new DatabaseSync(path, {
      readOnly: true
    })
    try {
      const {runtime, descriptor} = await openCheckpoint(
        this.#options.config,
        nodeDatabase(sqlite),
        identity
      )
      return {
        path,
        identity,
        revision: descriptor.sourceSha,
        runtime,
        sqlite,
        readers: 0,
        retired: false
      }
    } catch (error) {
      sqlite.close()
      throw error
    }
  }

  #retire(snapshot: Snapshot) {
    snapshot.retired = true
    if (!snapshot.readers) snapshot.sqlite.close()
  }

  async resolve<const Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.#read(async snapshot => {
      if (!query.preview) return snapshot.runtime.resolve(query)
      const decoded = await decodePreviewRequest(query.preview)
      if ('contentHash' in decoded && decoded.contentHash !== snapshot.revision)
        throw new ShaMismatchError(decoded.contentHash, snapshot.revision)
      const preview = await applyPreview(snapshot.runtime, decoded)
      if (!preview) throw new Error('Preview patch could not be applied')
      return this.#resolvePreview(snapshot, query, preview)
    })
  }

  /** A file patch may survive unrelated tree changes. Verify and query on one
   * lease; fetch the remote tree once only if the required base is unavailable.
   */
  async resolvePreview<Query extends GraphQuery>(
    query: Query,
    source: RemoteSource
  ): Promise<AnyQueryResult<Query>> {
    if (!query.preview) return this.resolve(query)
    const decoded = await decodePreviewRequest(query.preview)
    for (let attempt = 0; ; attempt++) {
      const result = await this.#read(async snapshot => {
        const preview = await applyPreview(snapshot.runtime, decoded)
        if (!preview) return {revision: snapshot.revision}
        return {value: await this.#resolvePreview(snapshot, query, preview)}
      })
      if ('value' in result) return result.value!
      if (
        attempt ||
        !('contentHash' in decoded) ||
        result.revision === decoded.contentHash
      )
        throw new Error('Preview patch could not be applied')
      await this.sync(source)
    }
  }

  async #resolvePreview<Query extends GraphQuery>(
    snapshot: Snapshot,
    query: Query,
    preview: DecodedEntryPreview
  ): Promise<AnyQueryResult<Query>> {
    const normalized = await normalizeEntryPreview(
      this.config,
      nodeDatabase(snapshot.sqlite),
      preview.entry
    )
    const overlay = await NodeOverlay.open(
      this.config,
      snapshot.path,
      snapshot.identity,
      normalized.entries
    )
    try {
      return await overlay.resolve<Query>({...query, preview: undefined})
    } finally {
      overlay.close()
    }
  }

  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    return this.#read(snapshot =>
      entryReferencesTo(nodeDatabase(snapshot.sqlite), query)
    )
  }

  /** Copy one leased immutable generation, never overwrite a caller's file. */
  captureCheckpoint(destination: string): Promise<CheckpointCapture> {
    return this.#read(async snapshot => {
      await copyFile(
        snapshot.path,
        destination,
        constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE
      )
      return {identity: {...snapshot.identity}, revision: snapshot.revision}
    })
  }

  async #read<T>(read: (snapshot: Snapshot) => Promise<T>): Promise<T> {
    if (this.#closed || !this.#current)
      throw new Error('SQLite replica is closed or not ready')
    const snapshot = this.#current
    snapshot.readers++
    try {
      return await read(snapshot)
    } finally {
      snapshot.readers--
      if (snapshot.retired && !snapshot.readers) snapshot.sqlite.close()
    }
  }

  /** Open restores the prior view immediately; sync reconciles the requested source. */
  sync(source: RemoteSource): Promise<boolean> {
    if (this.#closed)
      return Promise.reject(new Error('SQLite replica is closed'))
    const update = this.#updates.then(() => this.#sync(source))
    this.#updates = update.catch(() => {})
    return update
  }

  /** Prepare against a private scratch copy, never the published reader file.
   * The request still needs an exact-revision commit at the source authority.
   */
  request(
    mutations: ReadonlyArray<Mutation>,
    policy: Policy
  ): Promise<CommitRequest> {
    if (this.#closed)
      return Promise.reject(new Error('SQLite replica is closed'))
    const request = this.#updates.then(() => this.#request(mutations, policy))
    this.#updates = request.catch(() => {})
    return request
  }

  requestFix(): Promise<CommitRequest> {
    if (this.#closed)
      return Promise.reject(new Error('SQLite replica is closed'))
    const request = this.#updates.then(() =>
      this.#read(async snapshot =>
        this.#request(await fixDatabase(snapshot.runtime), Policy.ALLOW_ALL)
      )
    )
    this.#updates = request.catch(() => {})
    return request
  }

  async #request(
    mutations: ReadonlyArray<Mutation>,
    policy: Policy
  ): Promise<CommitRequest> {
    if (this.#closed || !this.#current)
      throw new Error('SQLite replica is closed or not ready')
    const {directory, config} = this.#options
    const snapshot = this.#current
    const scratch = join(directory, `.mutation-${randomUUID()}.sqlite`)
    try {
      // Reflink where available; other filesystems fall back to a file copy.
      await copyFile(snapshot.path, scratch, constants.COPYFILE_FICLONE)
      if (this.#closed) throw new Error('SQLite replica is closed')
      const sqlite = new DatabaseSync(scratch)
      try {
        const request = await sqlMutationRequest(
          config,
          nodeDatabase(sqlite),
          snapshot.identity,
          mutations,
          policy
        )
        if (this.#closed) throw new Error('SQLite replica is closed')
        return request
      } finally {
        sqlite.close()
      }
    } finally {
      await Promise.all(
        ['', '-journal', '-wal', '-shm'].map(suffix =>
          rm(`${scratch}${suffix}`, {force: true})
        )
      )
    }
  }

  async #sync(source: RemoteSource): Promise<boolean> {
    if (this.#closed) throw new Error('SQLite replica is closed')
    const previous = this.#current
    const tree =
      previous && (await source.getTreeIfDifferent(previous.revision))
    if (this.#closed) throw new Error('SQLite replica is closed')
    if (previous && (!tree || tree.sha === previous.revision)) return false
    const {directory, config} = this.#options
    const identity = previous?.identity ?? this.#options.identity
    const id = randomUUID()
    const file = `checkpoint-${id}.sqlite`
    const pending = join(directory, `.pending-${id}.sqlite`)
    const pointer = join(directory, `.pointer-${id}.json`)
    let next: Snapshot | undefined
    try {
      if (previous)
        await copyFile(
          previous.path,
          pending,
          constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE
        )
      else await writeFile(pending, new Uint8Array(), {flag: 'wx', mode: 0o600})
      const sqlite = new DatabaseSync(pending)
      try {
        const db = nodeDatabase(sqlite)
        if (previous)
          await reconcileDatabase(
            config,
            db,
            {
              getTreeIfDifferent: async () => tree,
              getBlobs: source.getBlobs.bind(source)
            },
            identity
          )
        else await buildDatabase(config, db, source, identity)
        sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
        sqlite.exec('PRAGMA journal_mode=DELETE')
      } finally {
        sqlite.close()
      }
      await rename(pending, join(directory, file))
      next = await this.#openSnapshot(join(directory, file), identity)
      await writeFile(pointer, JSON.stringify({file, identity}))
      if (this.#closed) throw new Error('SQLite replica is closed')
      await rename(pointer, join(directory, 'current.json'))
      if (this.#closed) throw new Error('SQLite replica is closed')
      this.#current = next
      next = undefined
      if (previous) this.#retire(previous)
      for (const invalidate of this.#listeners) invalidate()
      return true
    } finally {
      if (next) this.#retire(next)
      await rm(pending, {force: true})
      await rm(pointer, {force: true})
    }
  }

  subscribe(query: GraphQuery, observer: QueryObserver): () => void {
    if (this.#closed) throw new Error('SQLite replica is closed')
    let active = true
    let sequence = 0
    const invalidate = () => {
      const current = ++sequence
      this.resolve(query).then(
        value => {
          if (active && !this.#closed && current === sequence)
            observer.next(value)
        },
        error => {
          if (active && !this.#closed && current === sequence)
            observer.error(error)
        }
      )
    }
    this.#listeners.add(invalidate)
    invalidate()
    return () => {
      active = false
      sequence++
      this.#listeners.delete(invalidate)
    }
  }

  /** New reads stop immediately; in-flight queries retain their connection. */
  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    this.#listeners.clear()
    if (this.#current) this.#retire(this.#current)
    await this.#updates
  }
}
