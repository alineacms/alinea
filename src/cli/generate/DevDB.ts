import * as fsp from 'node:fs/promises'
import type {ReferenceRequest} from '#/database/replica/ReferenceBatch.js'
import {Config} from '#/core/Config.js'
import type {SyncApi, UploadResponse} from '#/core/Connection.js'
import {
  sourceChanges,
  type CommitRequest,
  type CommitTransaction,
  type CommitReceipt
} from '#/core/db/CommitRequest.js'
import {HttpError} from '#/core/HttpError.js'
import {DevReceipts} from './DevReceipts.js'
import {WritableGraph} from '#/core/db/WritableGraph.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {EntryReferenceQuery} from '#/core/db/EntryReference.js'
import {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {createId} from '#/core/Id.js'
import {getWorkspace} from '#/core/Internal.js'
import {CachedFSSource} from '#/core/source/FSSource.js'
import {diff} from '#/core/source/Source.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {assert} from '#/core/util/Assert.js'
import {keys, values, isRecord} from '#/core/util/Objects.js'
import {basename, contains, dirname, extname, join} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import type {GraphQuery, AnyQueryResult} from '#/core/Graph.js'
import {NodeReplica} from '#/database/driver/NodeReplica.js'
import type {CheckpointIdentity} from '#/database/runtime/Checkpoint.js'
import type {QueryObserver} from '#/database/runtime/EntryRuntime.js'
import {seedDatabase} from '#/database/runtime/SeedDatabase.js'
import type {IndexBootstrap} from '#/database/replica/Bootstrap.js'
import type {
  PayloadBatch,
  PayloadBatchRequest
} from '#/database/replica/PayloadBatch.js'
import pLimit from 'p-limit'

export interface DevDBOptions {
  config: Config
  rootDir: string
  dashboardUrl: string | undefined
  /** Private SQL cache, isolated between build and dev commands. */
  replica: {directory: string; identity: CheckpointIdentity}
}

export interface WatchFiles {
  files: Array<string>
  dirs: Array<string>
}

export class DevDB extends WritableGraph {
  readonly config: Config
  source: CachedFSSource
  #options: DevDBOptions
  #replica?: NodeReplica
  #sync = pLimit(1)
  #closed = false
  #receipts?: DevReceipts

  constructor(options: DevDBOptions) {
    const source = new CachedFSSource(
      join(options.rootDir, Config.contentDir(options.config))
    )
    super()
    this.config = options.config
    this.#options = options
    this.source = source
  }

  async sync() {
    return this.#sync(() => this.#syncSource())
  }

  syncWith(remote: SyncApi): Promise<string> {
    return this.#sync(async () => {
      if (this.#closed) throw new Error('Dev database is closed')
      await this.source.refresh()
      await this.#recoverReceipts()
      const batch = await diff(this.source, remote)
      if (this.#closed) throw new Error('Dev database is closed')
      await this.source.applyChanges(batch)
      return this.#syncSource()
    })
  }

  getTreeIfDifferent(sha: string) {
    return this.source.getTreeIfDifferent(sha)
  }

  captureCheckpoint(destination: string) {
    if (this.#closed || !this.#replica)
      throw new Error('Dev database is not ready')
    return this.#replica.captureCheckpoint(destination)
  }

  async #syncSource() {
    if (this.#closed) throw new Error('Dev database is closed')
    await this.source.refresh()
    await this.#recoverReceipts()
    this.#replica ??= await NodeReplica.open(
      {config: this.config, ...this.#options.replica},
      this.source
    )
    await this.#replica.sync(this.source)
    for await (const mutation of seedDatabase(this.config, this.#replica)) {
      const request = await this.#replica.request([mutation], Policy.ALLOW_ALL)
      if (this.#closed) throw new Error('Dev database is closed')
      await this.source.applyChanges(sourceChanges(request))
      await this.#replica.sync(this.source)
    }
    if (this.#closed) {
      await this.#replica.close()
      throw new Error('Dev database is closed')
    }
    return this.#replica.revision
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    if (this.#closed) return Promise.reject(new Error('Dev database is closed'))
    if (!this.#replica)
      return Promise.reject(new Error('Dev database is not ready'))
    return this.#replica.resolve(query)
  }

  get sha(): string {
    if (this.#closed || !this.#replica)
      throw new Error('Dev database is not ready')
    return this.#replica.revision
  }

  replicaIdentity(): Promise<CheckpointIdentity> {
    if (this.#closed || !this.#replica)
      return Promise.reject(new Error('Dev database is not ready'))
    return this.#replica.identity()
  }

  bootstrap(
    principal: string,
    roles: ReadonlyArray<string>
  ): Promise<IndexBootstrap> {
    if (this.#closed || !this.#replica)
      return Promise.reject(new Error('Dev database is not ready'))
    return this.#replica.bootstrap(principal, roles)
  }

  referenceBatch(
    principal: string,
    roles: ReadonlyArray<string>,
    request: ReferenceRequest
  ) {
    if (this.#closed || !this.#replica)
      return Promise.reject(new Error('Dev database is not ready'))
    return this.#replica.referenceBatch(principal, roles, request)
  }

  payloads(
    principal: string,
    roles: ReadonlyArray<string>,
    request: PayloadBatchRequest
  ): Promise<PayloadBatch> {
    if (this.#closed || !this.#replica)
      return Promise.reject(new Error('Dev database is not ready'))
    return this.#replica.payloads(principal, roles, request)
  }

  subscribe(query: GraphQuery, observer: QueryObserver): () => void {
    if (this.#closed || !this.#replica)
      throw new Error('Dev database is not ready')
    return this.#replica.subscribe(query, observer)
  }

  async close(): Promise<void> {
    this.#closed = true
    await this.#replica?.close()
    // Drain a startup/sync already in progress, including its newly opened owner.
    await this.#sync(async () => {
      await this.#replica?.close()
      this.#receipts?.close()
      this.#receipts = undefined
    })
  }

  async fix() {
    await this.#sync(async () => {
      await this.#syncSource()
      const request = await this.#replica!.requestFix()
      await this.#write(request)
    })
  }

  referencesTo(query: EntryReferenceQuery) {
    if (this.#closed || !this.#replica)
      return Promise.reject(new Error('Dev database is not ready'))
    return this.#replica.referencesTo(query)
  }

  async request(
    mutations: ReadonlyArray<Mutation>,
    policy = Policy.ALLOW_ALL,
    user?: User
  ) {
    user = user ? structuredClone(user) : undefined
    if (this.#closed) throw new Error('Dev database is closed')
    await this.sync()
    if (!this.#replica) throw new Error('Dev database is not ready')
    return this.#replica.request(mutations, policy, user)
  }

  async watchFiles() {
    const {rootDir, config} = this.#options
    const singleWorkspace = Config.multipleWorkspaces(config)
      ? undefined
      : keys(config.workspaces)[0]
    const tree = await this.source.getTree()
    const res: WatchFiles = {files: [], dirs: []}
    for (const [path, node] of tree) {
      const segments = path.split('/')
      const workspace = singleWorkspace ?? segments.shift()!
      const hasWorkspace = config.workspaces[workspace]
      if (!hasWorkspace) continue
      const contentDir = getWorkspace(hasWorkspace).source
      const fullPath = join(rootDir, contentDir, segments.join('/'))
      if (node.type === 'tree') res.dirs.push(fullPath)
      else res.files.push(fullPath)
    }
    return res
  }

  isInMediaLocation(file: string): boolean {
    const {config, rootDir} = this.#options
    const mediaDirs: Array<string> = values(config.workspaces)
      .map(workspace => getWorkspace(workspace).mediaDir!)
      .filter(Boolean)
    return mediaDirs.some(dir => contains(join(rootDir, dir), file))
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    request = structuredClone(request)
    return this.#sync(() => this.#write(request))
  }

  async #receiptStore(create = false): Promise<DevReceipts | undefined> {
    if (this.#receipts) return this.#receipts
    const path = join(
      this.#options.rootDir,
      '.alinea',
      'local',
      'receipts.sqlite'
    )
    if (!create) {
      try {
        await fsp.access(path)
      } catch (error) {
        if (isRecord(error) && error.code === 'ENOENT') return
        throw error
      }
    }
    if (
      contains(
        join(this.#options.rootDir, Config.contentDir(this.config)),
        path
      )
    )
      throw new HttpError(
        409,
        'Filesystem receipt storage must be outside the content directory'
      )
    return (this.#receipts = await DevReceipts.open(
      path,
      this.#options.replica.identity.project
    ))
  }

  #checkTransaction(transaction: CommitTransaction): void {
    const {namespace, epoch} = this.#options.replica.identity
    if (transaction.namespace !== namespace || transaction.epoch !== epoch)
      throw new HttpError(409, 'Filesystem transaction scope mismatch')
  }

  async #recoverReceipts(): Promise<void> {
    const receipts = await this.#receiptStore()
    if (!receipts) return
    await receipts.recover(
      (await this.source.getTree()).sha,
      async locations => {
        for (const location of locations) {
          const file = join(this.#options.rootDir, location)
          if (!this.isInMediaLocation(file)) return false
          try {
            await fsp.stat(file)
            return false
          } catch (error) {
            if (!isRecord(error) || error.code !== 'ENOENT') throw error
          }
        }
        return true
      }
    )
  }

  receipt(
    principal: string,
    transaction: CommitTransaction
  ): Promise<CommitReceipt | undefined> {
    transaction = {...transaction}
    return this.#sync(async () => {
      if (this.#closed) throw new Error('Dev database is closed')
      this.#checkTransaction(transaction)
      await this.source.refresh()
      await this.#recoverReceipts()
      return (await this.#receiptStore())?.receipt(principal, transaction)
    })
  }

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.write(await this.request(mutations))
  }

  async #write(request: CommitRequest): Promise<{sha: string}> {
    if (this.#closed) throw new Error('Dev database is closed')
    await this.source.refresh()
    await this.#recoverReceipts()
    if (request.transaction) {
      this.#checkTransaction(request.transaction)
      const accepted = await (
        await this.#receiptStore()
      )?.receipt(request.user?.sub ?? '', request.transaction)
      if (accepted) return {sha: accepted.sha}
    }
    const receipts = await this.#receiptStore(Boolean(request.transaction))
    await receipts?.assertAvailable()
    await this.source.refresh()
    const tree = await this.source.getTree()
    const sourceSha = tree.sha
    if (!request.transaction && sourceSha === request.intoSha)
      return {sha: await this.#syncSource()}
    if (sourceSha !== request.fromSha)
      throw new ShaMismatchError(request.fromSha, sourceSha)
    const batch = sourceChanges(request)
    for (const change of batch.changes)
      if (
        change.op === 'add' &&
        (!change.contents || (await hashBlob(change.contents)) !== change.sha)
      )
        throw new Error('Commit blob hash mismatch')
    if ((await tree.withChanges(batch)).sha !== request.intoSha)
      throw new Error('Commit target revision mismatch')
    if (this.sha !== request.fromSha)
      throw new ShaMismatchError(request.fromSha, this.sha)
    const {rootDir} = this.#options
    // Validate every media path before a prepared receipt or any file effect.
    for (const change of request.changes)
      if (change.op === 'removeFile')
        assert(
          this.isInMediaLocation(join(rootDir, change.location)),
          `Invalid media location: ${change.location}`
        )
    const key = request.transaction
      ? await receipts!.prepare(request)
      : undefined
    for (const change of request.changes) {
      switch (change.op) {
        // Uploaded files will be put in the right folder by the server
        // during upload
        case 'removeFile': {
          const location = join(rootDir, change.location)
          assert(
            this.isInMediaLocation(location),
            `Invalid media location: ${location}`
          )
          await fsp.rm(location, {force: true})
        }
      }
    }
    await this.source.applyChanges(sourceChanges(request))
    await this.source.refresh()
    if ((await this.source.getTree()).sha !== request.intoSha)
      throw new Error('Filesystem commit did not reach its target revision')
    if (key) await receipts!.accept(key)
    const sha = await this.#syncSource()
    return {sha: key ? request.intoSha : sha}
  }

  async prepareUpload(file: string): Promise<UploadResponse> {
    const {dashboardUrl} = this.#options
    assert(dashboardUrl, 'Dashboard URL is required for upload')
    const entryId = createId()
    const dir = dirname(file)
    const extension = extname(file).toLowerCase()
    const name = basename(file, extension)
    const fileName = `${slugify(name)}.${entryId}${extension}`
    const fileLocation = join(dir, fileName)
    return {
      entryId,
      location: fileLocation,
      previewUrl: '',
      url: new URL(
        `?/upload&file=${encodeURIComponent(fileLocation)}`,
        dashboardUrl
      ).href
    }
  }
}
