import * as fsp from 'node:fs/promises'
import {Config} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import {type CommitRequest, checkCommit} from '#/core/db/CommitRequest.js'
import {createId} from '#/core/Id.js'
import {getWorkspace} from '#/core/Internal.js'
import {CachedFSSource, type FSSourceSnapshot} from '#/core/source/FSSource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {accumulate} from '#/core/util/Async.js'
import {assert} from '#/core/util/Assert.js'
import {keys, values} from '#/core/util/Objects.js'
import {basename, contains, dirname, extname, join} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {FileRangeSource} from '#/database/replica/FileTransport.js'
import {MemoryRangeSource} from '#/database/replica/Bundle.js'
import {
  exportRuntimeEntryOverlay,
  type RuntimeEntryOverlayExport
} from '#/database/runtime/Exporter.js'
import type {RuntimeDatabaseIndex} from '#/database/runtime/Model.js'
import {RuntimeEntryStore} from '#/database/runtime/Store.js'
import pLimit from 'p-limit'

export interface DevDBCheckpoint {
  index: RuntimeDatabaseIndex
  payloadFile: string
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
  #runtime?: RuntimeEntryStore
  #runtimeIndex?: RuntimeDatabaseIndex
  #overlaySources = new Map<string, MemoryRangeSource>()
  #syncLimit = pLimit(1)
  #needsCheckpoint: boolean

  constructor(options: DevDBOptions) {
    const checkpoint = options.checkpoint
    const sourceSnapshot: FSSourceSnapshot | undefined =
      checkpoint?.index.source && checkpoint.index.development
        ? {
            tree: checkpoint.index.source.tree,
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
    this.#runtime = runtime
    this.#runtimeIndex = checkpoint?.index
    this.#needsCheckpoint = !checkpoint
  }

  async sync() {
    return this.#syncLimit(async () => {
      await this.source.refresh()
      if (await this.#syncRuntime()) return this.sha
      this.#runtime = undefined
      this.#runtimeIndex = undefined
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
    this.#runtime = runtime
    this.#runtimeIndex = checkpoint.index
    this.#overlaySources.clear()
    this.#needsCheckpoint = false
    this.refreshRuntime(runtime)
  }

  async #syncRuntime(): Promise<boolean> {
    const runtime = this.#runtime
    let index = this.#runtimeIndex
    if (!runtime || !index?.source) return false
    const tree = await this.source.getTree()
    if (tree.sha === index.revision) return true
    const previous = new ReadonlyTree(index.source.tree)
    const batch = previous.diff(tree)
    const changes = batch.changes
    const entries = index.entries
    if (
      changes.some(
        change =>
          change.op !== 'add' ||
          !previous.has(change.path) ||
          !entries.some(entry => entry.frames?.read?.filePath === change.path)
      )
    )
      return false
    const blobs = new Map(
      await accumulate(this.source.getBlobs(changes.map(change => change.sha)))
    )
    const overlays: Array<{
      url: string
      result: RuntimeEntryOverlayExport
      plaintext: Uint8Array
    }> = []
    for (const change of changes) {
      const bundleId = `dev-${createId()}`
      const bundleUrl = `alinea:dev-overlay/${bundleId}`
      const contents = blobs.get(change.sha)
      if (!contents) return false
      const overlay = await exportRuntimeEntryOverlay({
        config: this.config,
        index,
        bundleId,
        bundleUrl,
        filePath: change.path,
        fileHash: change.sha,
        contents,
        tree
      })
      if (!overlay) return false
      overlays.push({url: bundleUrl, result: overlay, plaintext: contents})
      index = overlay.index
    }
    for (const overlay of overlays)
      this.#overlaySources.set(
        overlay.url,
        new MemoryRangeSource(overlay.result.bundle)
      )
    const snapshot = this.source.snapshot()
    index = {
      ...index,
      development: index.development
        ? {...index.development, files: snapshot.files}
        : undefined
    }
    runtime.install(index, url => {
      const source = this.#overlaySources.get(url)
      assert(source, `Unknown development overlay: ${url}`)
      return source
    })
    for (const overlay of overlays)
      runtime.prime(overlay.result.entry, overlay.plaintext)
    this.#runtimeIndex = index
    this.refreshRuntime(runtime)
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

  async write(request: CommitRequest): Promise<{sha: string}> {
    if (this.sha === request.intoSha) return {sha: this.sha}
    if (this.sha !== request.fromSha) {
      const tree = await this.source.getTree()

      // Run checks to see if we can commit anyway. This is still not atomic in
      // any sense because filesystem changes can happen in between the check
      // and the commit but it should be good enough for now.
      checkCommit(tree, request)
    }
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
    return super.write(request)
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
