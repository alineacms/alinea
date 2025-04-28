import * as fsp from 'node:fs/promises'
import {Config} from 'alinea/core/Config'
import type {UploadResponse} from 'alinea/core/Connection'
import {createId} from 'alinea/core/Id'
import {getWorkspace} from 'alinea/core/Internal'
import {type CommitRequest, checkCommit} from 'alinea/core/db/CommitRequest'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {CachedFSSource} from 'alinea/core/source/FSSource'
import {assert} from 'alinea/core/source/Utils'
import {keys, values} from 'alinea/core/util/Objects'
import {
  basename,
  contains,
  dirname,
  extname,
  join
} from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'

export interface DevDBOptions {
  config: Config
  rootDir: string
  dashboardUrl: string | undefined
}

export interface WatchFiles {
  files: Array<string>
  dirs: Array<string>
}

export class DevDB extends LocalDB {
  source: CachedFSSource
  #options: DevDBOptions

  constructor(options: DevDBOptions) {
    const source = new CachedFSSource(
      join(options.rootDir, Config.contentDir(options.config))
    )
    super(options.config, source)
    this.#options = options
    this.source = source
  }

  async sync() {
    await this.source.refresh()
    return super.sync()
  }

  async fix() {
    await this.index.fix(this.source)
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
      previewUrl: new URL(
        `?/preview&file=${encodeURIComponent(fileLocation)}`,
        dashboardUrl
      ).href,
      url: new URL(
        `?/upload&file=${encodeURIComponent(fileLocation)}`,
        dashboardUrl
      ).href
    }
  }
}
