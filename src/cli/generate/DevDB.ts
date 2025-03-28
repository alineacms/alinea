import * as fsp from 'node:fs/promises'
import {Config} from 'alinea/core/Config'
import type {UploadResponse} from 'alinea/core/Connection'
import {createId} from 'alinea/core/Id'
import {getWorkspace} from 'alinea/core/Internal'
import type {CommitRequest} from 'alinea/core/db/CommitRequest'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {FSSource} from 'alinea/core/source/FSSource'
import {assert} from 'alinea/core/source/Utils'
import {values} from 'alinea/core/util/Objects'
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
  source: FSSource
  #options: DevDBOptions

  constructor(options: DevDBOptions) {
    const workspace = Config.mainWorkspace(options.config)
    const contentDir = join(options.rootDir, workspace.source)
    const source = new FSSource(contentDir)
    super(options.config, source)
    this.#options = options
    this.source = source
  }

  async watchFiles() {
    const {rootDir} = this.#options
    const tree = await this.source.getTree()
    const res: WatchFiles = {files: [], dirs: []}
    for (const [path, node] of tree) {
      const fullPath = join(rootDir, path)
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

  async commit(request: CommitRequest): Promise<string> {
    const {rootDir} = this.#options
    for (const change of request.changes) {
      switch (change.op) {
        // Uploaded files are will be put in the right folder by the server
        // during upload
        case 'removeFile': {
          const location = join(rootDir, change.location)
          await fsp.rm(location, {force: true})
        }
      }
    }
    return super.commit(request)
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
