import {FS} from 'alinea/backend/FS'
import {Connection, HttpError} from 'alinea/core'
import {Config} from 'alinea/core/Config'
import {outcome} from 'alinea/core/Outcome'
import {Root} from 'alinea/core/Root'
import {Workspace} from 'alinea/core/Workspace'
import {entries, keys, values} from 'alinea/core/util/Objects'
import * as path from 'alinea/core/util/Paths'
import {Media} from '../Media.js'
import {Source, SourceEntry, WatchFiles} from '../Source.js'
import {Target} from '../Target.js'

export type FileDataOptions = {
  config: Config
  fs: FS
  rootDir?: string
}

async function filesOfPath(fs: FS, dir: string): Promise<WatchFiles> {
  const res: WatchFiles = {files: [], dirs: []}
  try {
    const files = await fs.readdir(dir)
    for (const file of files) {
      const location = path.join(dir, file)
      const stat = await fs.stat(location)
      if (stat.isDirectory()) {
        const contents = await filesOfPath(fs, location)
        res.dirs.push(location, ...contents.dirs)
        res.files.push(...contents.files)
      } else {
        res.files.push(location)
      }
    }
    return res
  } catch (e) {
    return res
  }
}

export class FileData implements Source, Target, Media {
  canRename = true

  constructor(public options: FileDataOptions) {}

  async watchFiles() {
    const {fs, config, rootDir = '.'} = this.options
    const res: WatchFiles = {files: [], dirs: []}
    for (const workspace of values(config.workspaces)) {
      const contentDir = Workspace.data(workspace).source
      for (const rootName of keys(workspace)) {
        const rootPath = path.join(rootDir, contentDir, rootName)
        res.dirs.push(rootPath)
        const contents = await filesOfPath(fs, rootPath)
        res.files.push(...contents.files)
        res.dirs.push(...contents.dirs)
      }
    }
    return res
  }

  async *entries(): AsyncGenerator<SourceEntry> {
    const {config, fs, rootDir = '.'} = this.options
    const BATCH_SIZE = 4
    const batch: Array<() => Promise<SourceEntry>> = []
    async function* runBatch() {
      for (const entry of await Promise.all(
        batch.splice(0, batch.length).map(fn => fn())
      ))
        yield entry
    }
    for (const [workspaceName, workspace] of entries(config.workspaces)) {
      const contentDir = Workspace.data(workspace).source
      for (const [rootName, root] of entries(workspace)) {
        const {i18n} = Root.data(root)
        const locales = i18n?.locales || [undefined]
        for (const locale of locales) {
          const targets = [locale ? `/${locale}` : '/']
          while (targets.length > 0) {
            const target = targets.shift()!
            const [files, err] = await outcome(
              fs.readdir(path.join(rootDir, contentDir, rootName, target))
            )
            if (!files) continue
            const toRead = []
            for (const file of files) {
              const location = path.join(
                rootDir,
                contentDir,
                rootName,
                target,
                file
              )
              const stat = await fs.stat(location)
              if (stat.isDirectory()) {
                targets.push(path.join(target, file))
              } else {
                if (batch.length >= BATCH_SIZE) yield* runBatch()
                const filePath = path.join(target, file)
                toRead.push({filePath, location})
                batch.push(async (): Promise<SourceEntry> => {
                  const contents = await fs.readFile(location)
                  return {
                    workspace: workspaceName,
                    root: rootName,
                    filePath,
                    contents,
                    modifiedAt: stat.mtime.getTime()
                  }
                })
              }
            }
          }
        }
      }
    }
    yield* runBatch()
  }

  async publishChanges({changes}: Connection.ChangesParams) {
    const {fs, rootDir = '.'} = this.options
    const tasks = []
    const noop = () => {}
    for (const {file, contents} of changes.write) {
      const location = path.join(rootDir, file)
      tasks.push(
        fs
          .mkdir(path.dirname(location), {recursive: true})
          .catch(noop)
          .then(() => fs.writeFile(location, contents))
      )
    }
    for (const {file: a, to: b} of changes.rename) {
      const location = path.join(rootDir, a)
      const newLocation = path.join(rootDir, b)
      tasks.push(fs.rename(location, newLocation).catch(noop))
    }
    for (const {file} of changes.delete) {
      const location = path.join(rootDir, file)
      tasks.push(fs.rm(location, {recursive: true, force: true}).catch(noop))
    }
    return Promise.all(tasks).then(() => void 0)
  }

  isInMediaLocation(file: string): boolean {
    const {config, rootDir = '.'} = this.options
    const mediaDirs: Array<string> = values(config.workspaces)
      .map(workspace => Workspace.data(workspace).mediaDir!)
      .filter(Boolean)
    return mediaDirs.some(dir => path.contains(path.join(rootDir, dir), file))
  }

  async upload({
    fileLocation,
    buffer
  }: Connection.MediaUploadParams): Promise<string> {
    const {fs, rootDir = '.'} = this.options
    const file = path.join(rootDir, fileLocation)
    const isInMediaLocation = this.isInMediaLocation(file)
    if (!isInMediaLocation) throw new HttpError(401)
    const dir = path.dirname(file)
    await fs.mkdir(dir, {recursive: true})
    await fs.writeFile(file, Buffer.from(buffer))
    return fileLocation
  }

  async download({
    location
  }: Connection.DownloadParams): Promise<Connection.Download> {
    const {fs, rootDir = '.'} = this.options
    const file = path.join(rootDir, location)
    const isInMediaLocation = this.isInMediaLocation(file)
    if (!isInMediaLocation) throw new HttpError(401)
    return {type: 'buffer', buffer: await fs.readFile(file)}
  }
}
