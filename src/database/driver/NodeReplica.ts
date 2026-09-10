import type {Config} from '#/core/Config.js'
import type {User} from '#/core/User.js'
import {
  applyPreview,
  decodePreviewRequest
} from '#/backend/resolver/ParsePreview.js'
import type {DecodedEntryPreview} from '#/backend/resolver/ParsePreview.js'
import {Graph, type GraphQuery, type AnyQueryResult} from '#/core/Graph.js'
import {Policy} from '#/core/Role.js'
import {sourceChanges, type CommitRequest} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import type {GetBlobsOptions, RemoteSource} from '#/core/source/Source.js'
import {hashBlob} from '#/core/source/GitUtils.js'
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
import {SqlSource} from '../source/SqlSource.js'
import {authorizedIndex} from '../handler/Policy.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import {GrantService} from '../handler/Grants.js'
import {FrameStore} from '../release/FrameStore.js'
import {
  payloadBatchLimit,
  type PayloadBatch,
  type PayloadBatchRequest
} from '../replica/PayloadBatch.js'
import {base64} from '#/core/util/Encoding.js'
import {HttpError} from '#/core/HttpError.js'

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

  identity(): Promise<CheckpointIdentity> {
    return this.#read(async snapshot => ({...snapshot.identity}))
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

  getTree() {
    return this.#read(snapshot => this.#source(snapshot).getTree())
  }

  /** Principal and roles must come from a verified, enriched handler session. */
  bootstrap(
    principal: string,
    roles: ReadonlyArray<string>
  ): Promise<IndexBootstrap> {
    if (!principal)
      return Promise.reject(new Error('Missing replica principal'))
    roles = [...roles]
    return this.#read(async snapshot => {
      const view = await authorizedIndex(snapshot.runtime, roles)
      return {
        version: 1,
        identity: {...snapshot.identity, principal, viewId: view.viewId},
        revision: view.revision,
        permissions: view.permissions,
        scopePolicy: view.scopePolicy,
        entries: view.entries
      }
    })
  }

  getTreeIfDifferent(sha: string) {
    return this.#read(snapshot =>
      this.#source(snapshot).getTreeIfDifferent(sha)
    )
  }

  payloads(
    principal: string,
    roles: ReadonlyArray<string>,
    request: PayloadBatchRequest
  ): Promise<PayloadBatch> {
    roles = [...roles]
    request = structuredClone(request)
    return this.#read(async snapshot => {
      if (
        !principal ||
        request.identity.principal !== principal ||
        !identityKeys.every(
          key => request.identity[key] === snapshot.identity[key]
        )
      )
        throw new HttpError(409, 'Replica identity mismatch')
      const frames = new FrameStore(nodeDatabase(snapshot.sqlite))
      const service = new GrantService(
        snapshot.runtime,
        frames,
        snapshot.identity
      )
      const grants = await service.issue(
        roles,
        {
          revision: request.revision,
          viewId: request.identity.viewId
        },
        request.requests
      )
      if (
        grants.reduce(
          (size, grant) => size + grant.descriptor.ciphertextLength,
          0
        ) > payloadBatchLimit
      )
        throw new HttpError(413, 'Payload batch exceeds byte limit')
      const encoded: PayloadBatch['frames'] = []
      for (const {descriptor, key} of grants) {
        const ciphertext = await frames.ciphertext(descriptor)
        if (ciphertext.byteLength !== descriptor.ciphertextLength)
          throw new Error('Stored frame length mismatch')
        encoded.push({
          descriptor: {
            ...descriptor,
            nonce: base64.stringify(descriptor.nonce)
          },
          key: base64.stringify(key),
          ciphertext: base64.stringify(ciphertext)
        })
      }
      return {
        version: 1,
        identity: request.identity,
        revision: request.revision,
        frames: encoded
      }
    })
  }

  async *getBlobs(
    shas: ReadonlyArray<string>,
    options?: GetBlobsOptions
  ): AsyncGenerator<[string, Uint8Array]> {
    if (this.#closed || !this.#current)
      throw new Error('SQLite replica is closed or not ready')
    const snapshot = this.#current
    snapshot.readers++
    try {
      yield* this.#source(snapshot).getBlobs(shas, options)
    } finally {
      snapshot.readers--
      if (snapshot.retired && !snapshot.readers) snapshot.sqlite.close()
    }
  }

  #source(snapshot: Snapshot) {
    return new SqlSource(
      nodeDatabase(snapshot.sqlite),
      snapshot.identity.namespace
    )
  }

  /** Cache an already accepted source commit. This is not a source write or a
   * durable retry receipt; a moved cache head requires remote catch-up instead.
   */
  acceptCommit(request: CommitRequest): Promise<{sha: string}> {
    if (this.#closed)
      return Promise.reject(new Error('SQLite replica is closed'))
    const update = this.#updates.then(() =>
      this.#read(async snapshot => {
        if (snapshot.revision === request.intoSha)
          return {sha: snapshot.revision}
        if (snapshot.revision !== request.fromSha)
          throw new ShaMismatchError(request.fromSha, snapshot.revision)
        const source = this.#source(snapshot)
        const batch = sourceChanges(request)
        const blobs = new Map<string, Uint8Array>()
        for (const change of batch.changes) {
          if (change.op === 'delete') continue
          if (
            !change.contents ||
            (await hashBlob(change.contents)) !== change.sha
          )
            throw new Error('Commit blob hash mismatch')
          blobs.set(change.sha, change.contents)
        }
        const tree = await (await source.getTree()).withChanges(batch)
        if (tree.sha !== request.intoSha)
          throw new Error('Commit target revision mismatch')
        await this.#sync({
          getTreeIfDifferent: async sha =>
            sha === tree.sha ? undefined : tree,
          async *getBlobs(shas, options) {
            for (const sha of shas) {
              options?.signal?.throwIfAborted()
              const contents = blobs.get(sha)
              if (contents) yield [sha, contents]
              else yield* source.getBlobs([sha], options)
            }
          }
        })
        return {sha: request.intoSha}
      })
    )
    this.#updates = update.catch(() => {})
    return update
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
    policy: Policy,
    user?: User
  ): Promise<CommitRequest> {
    if (this.#closed)
      return Promise.reject(new Error('SQLite replica is closed'))
    user = user ? structuredClone(user) : undefined
    const request = this.#updates.then(() =>
      this.#request(mutations, policy, user)
    )
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
    policy: Policy,
    user?: User
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
          policy,
          user
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
