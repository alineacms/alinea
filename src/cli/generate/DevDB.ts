import * as fsp from 'node:fs/promises'
import {Config} from '#/core/Config.js'
import type {UploadResponse} from '#/core/Connection.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {createId} from '#/core/Id.js'
import {getWorkspace} from '#/core/Internal.js'
import {CachedFSSource} from '#/core/source/FSSource.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {keys, values} from '#/core/util/Objects.js'
import {basename, contains, dirname, extname, join} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'

export interface DevDBOptions {
  config: Config
  rootDir: string
  databasePath: string
  dashboardUrl: string | undefined
}

export interface WatchFiles {
  files: Array<string>
  dirs: Array<string>
}

/** The persistent generated database used by dev, build and the local handler. */
export class DevDB extends EntryStore {
  declare readonly source: CachedFSSource
  #options: DevDBOptions

  private constructor(
    options: DevDBOptions,
    database: EntryDatabase,
    source: CachedFSSource
  ) {
    super(options.config, database, source, {ownsDatabase: true})
    this.#options = options
  }

  static async create(options: DevDBOptions): Promise<DevDB> {
    const source = new CachedFSSource(
      join(options.rootDir, Config.contentDir(options.config))
    )
    const db = await runtimeDatabase({path: options.databasePath})
    try {
      await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
      return new DevDB(options, new EntryDatabase(options.config, db), source)
    } catch (error) {
      await db.close()
      throw error
    }
  }

  override async sync(): Promise<string> {
    await this.source.refresh()
    return super.sync()
  }

  async finalize(): Promise<number> {
    await this.database.compact()
    return (await fsp.stat(this.#options.databasePath)).size
  }

  async fix(): Promise<never> {
    throw new Error('Source repair is not supported by the SQLite index')
  }

  async watchFiles(): Promise<WatchFiles> {
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

  override async write(request: CommitRequest): Promise<{sha: string}> {
    const current = await this.sha
    if (current === request.intoSha) return {sha: current}
    if (current !== request.fromSha)
      throw new ShaMismatchError(request.fromSha, current)
    const {rootDir} = this.#options
    for (const change of request.changes) {
      if (change.op !== 'removeFile') continue
      const location = join(rootDir, change.location)
      assert(
        this.isInMediaLocation(location),
        `Invalid media location: ${location}`
      )
      await fsp.rm(location, {force: true})
    }
    return super.write(request)
  }

  override async prepareUpload(file: string): Promise<UploadResponse> {
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
