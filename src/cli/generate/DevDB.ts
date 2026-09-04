import * as fsp from 'node:fs/promises'
import {Config} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import {type CommitRequest, sourceChanges} from '#/core/db/CommitRequest.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {createId} from '#/core/Id.js'
import {getWorkspace} from '#/core/Internal.js'
import {Policy} from '#/core/Role.js'
import {CachedFSSource, type FSSourceSnapshot} from '#/core/source/FSSource.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {bundleContents} from '#/core/source/Source.js'
import type {Tree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {keys, values} from '#/core/util/Objects.js'
import {basename, contains, dirname, extname, join} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {requestRuntimeSourceMutations} from '#/database/handler/SourceWriter.js'
import {FileRangeSource} from '#/database/replica/FileTransport.js'
import {exportRuntimeSourceChanges} from '#/database/runtime/Exporter.js'
import type {RuntimeDatabaseIndex} from '#/database/runtime/Model.js'
import {
  RuntimeSnapshot,
  runtimeDeltaEntryIds
} from '#/database/runtime/Snapshot.js'
import {RuntimeEntryStore} from '#/database/runtime/Store.js'
import pLimit from 'p-limit'

export interface DevDBCheckpoint {
  index: RuntimeDatabaseIndex
  payloadFile: string
  sourceTree?: Tree
}

export interface DevDBOptions {
  config: Config
  rootDir: string
  dashboardUrl: string | undefined
  checkpoint?: DevDBCheckpoint
}

export interface WatchFiles {
  files: Array<string>
  dirs: Array<string>
}

export class DevDB extends SourceDB {
  source: CachedFSSource
  #options: DevDBOptions
  #syncLimit = pLimit(1)
  #needsCheckpoint: boolean

  constructor(options: DevDBOptions) {
    const checkpoint = options.checkpoint
    const sourceSnapshot: FSSourceSnapshot | undefined =
      checkpoint?.sourceTree && checkpoint.index.development
        ? {
            tree: checkpoint.sourceTree,
            files: checkpoint.index.development.files
          }
        : undefined
    const source = new CachedFSSource(
      join(options.rootDir, Config.contentDir(options.config)),
      sourceSnapshot
    )
    const runtime = checkpoint
      ? new RuntimeEntryStore({
          index: checkpoint.index,
          source: () => new FileRangeSource(checkpoint.payloadFile)
        })
      : undefined
    super(options.config, source, runtime)
    this.#options = options
    this.source = source
    this.#needsCheckpoint = !checkpoint
  }

  async sync() {
    return this.#syncLimit(async () => {
      await this.source.refresh()
      if (await this.#syncRuntime()) return this.sha
      this.#needsCheckpoint = true
      return super.sync()
    })
  }

  get needsCheckpoint(): boolean {
    return this.#needsCheckpoint
  }

  checkpointWritten(): void {
    this.#needsCheckpoint = false
  }

  installCheckpoint(checkpoint: DevDBCheckpoint): void {
    const runtime = new RuntimeEntryStore({
      index: checkpoint.index,
      source: () => new FileRangeSource(checkpoint.payloadFile)
    })
    this.#needsCheckpoint = false
    this.refreshSnapshot(
      new RuntimeSnapshot(this.config, checkpoint.index, runtime)
    )
  }

  async #syncRuntime(): Promise<boolean> {
    const current = this.runtimeSnapshot
    if (!current?.index.source) return false
    const index = current.index
    const tree = await this.source.getTree()
    if (tree.sha === index.revision) return true
    const previous = await current.store.getTree()
    const changes = await bundleContents(this.source, previous.diff(tree))
    const bundleId = `dev-${createId()}`
    const bundleUrl = `alinea:dev-overlay/${bundleId}`
    const artifact = await exportRuntimeSourceChanges({
      config: this.config,
      previous: index,
      tree,
      changes,
      bundleId,
      bundleUrl
    })
    const snapshot = this.source.snapshot()
    artifact.delta.development = index.development
      ? {...index.development, files: snapshot.files}
      : null
    const next = current.apply(artifact)
    this.refreshSnapshot(next, runtimeDeltaEntryIds(artifact.delta))
    return true
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

  async request(
    mutations: Array<Mutation>,
    policy = Policy.ALLOW_ALL
  ): Promise<CommitRequest> {
    await this.sync()
    const snapshot = this.runtimeSnapshot
    if (!snapshot) return super.request(mutations, policy)
    return requestRuntimeSourceMutations(
      this.config,
      this.source,
      snapshot.store,
      snapshot.index,
      mutations,
      policy
    )
  }

  async write(request: CommitRequest): Promise<{sha: string}> {
    if (this.sha === request.intoSha) return {sha: this.sha}
    if (this.sha !== request.fromSha)
      throw new ShaMismatchError(request.fromSha, this.sha)
    const {rootDir} = this.#options
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
    return {sha: await this.sync()}
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
