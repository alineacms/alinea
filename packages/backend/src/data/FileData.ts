import {
  Config,
  createError,
  Entry,
  EntryStatus,
  Hub,
  outcome
} from '@alinea/core'
import * as path from '@alinea/core/util/Paths'
import {Cache} from '../Cache'
import {Data} from '../Data'
import {FS} from '../FS'
import {Loader} from '../Loader'
import {walkUrl} from '../util/EntryPaths'

export type FileDataOptions = {
  config: Config
  fs: FS
  loader: Loader
  rootDir?: string
}

interface Contents {
  files: Array<string>
  dirs: Array<string>
}

async function filesOfPath(fs: FS, dir: string): Promise<Contents> {
  const res: Contents = {files: [], dirs: []}
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

export class FileData implements Data.Source, Data.Target, Data.Media {
  canRename = true

  constructor(public options: FileDataOptions) {}

  async *entries(): AsyncGenerator<Entry> {
    const {config, fs, loader, rootDir = '.'} = this.options
    for (const [workspace, {source: contentDir, roots}] of Object.entries(
      config.workspaces
    )) {
      for (const root of Object.values(roots)) {
        const locales = root.i18n?.locales || [undefined]
        for (const locale of locales) {
          const targets = [locale ? `/${locale}` : '/']
          const parentIndex = new Map<string, Entry>()
          while (targets.length > 0) {
            const target = targets.shift()!
            const [files, err] = await outcome(
              fs.readdir(path.join(rootDir, contentDir, root.name, target))
            )
            if (!files) continue
            for (const file of files) {
              const location = path.join(
                rootDir,
                contentDir,
                root.name,
                target,
                file
              )
              const stat = await fs.stat(location)
              if (stat.isDirectory()) {
                targets.push(path.join(target, file))
              } else {
                const extension = path.extname(location)
                if (extension !== loader.extension) continue
                const name = path.basename(file, extension)
                const isIndex = name === 'index' || name === ''
                const buffer = await fs.readFile(location)
                const [entry, err] = outcome(() =>
                  loader.parse(config.schema, buffer)
                )
                if (!entry) {
                  console.log(`\rCould not parse ${location}: ${err}`)
                  continue
                }
                if (locale && !entry.alinea?.i18n) {
                  console.log(
                    `\rNo i18n id found for entry with id ${entry.id}`
                  )
                  continue
                }
                // Multiple roots in the same source folder can happen
                if (
                  entry &&
                  entry.alinea?.root &&
                  entry.alinea?.root !== root.name
                ) {
                  continue
                }
                const type = config.schema.type(entry.type)
                if (!type) continue
                const isContainer = Boolean(type.options.isContainer)
                const url = path.join(target, isIndex ? '' : name)
                const parentPath = target
                // Todo: just keep a list of parent ids while we iterate
                const parents = walkUrl(parentPath)
                  .map(url => parentIndex.get(url)!)
                  .filter(Boolean)
                const parent = parents[parents.length - 1]
                const entryUrl = Cache.createUrl(type, {
                  path: name,
                  parentPaths: parents.map(parent => parent.path),
                  locale
                })
                const res: Entry = {
                  ...entry,
                  path: name,
                  url: entryUrl,
                  alinea: {
                    workspace,
                    root: root.name,
                    index:
                      entry.alinea?.index ||
                      // Todo: this is for backwards compatibility, should
                      // deprecate next major version
                      (entry as any).index ||
                      undefined,
                    parent: parent?.id,
                    parents: parents.map(parent => parent.id),
                    status: EntryStatus.Published,
                    isContainer: isContainer,
                    i18n: locale
                      ? {
                          id:
                            entry.alinea.i18n?.id ||
                            // Todo: this is for backwards compatibility, should
                            // deprecate next major version
                            (entry as any).i18n?.id ||
                            entry.id,
                          locale,
                          parent: parent?.alinea.i18n?.id || parent?.id,
                          parents: parents.map(
                            parent => parent?.alinea.i18n?.id || parent?.id
                          )
                        }
                      : undefined
                  }
                }
                if (isContainer) parentIndex.set(url, res)
                yield res
              }
            }
          }
        }
      }
    }
  }

  async watchFiles() {
    const {fs, config, rootDir = '.'} = this.options
    const res: Contents = {files: [], dirs: []}
    for (const {source: contentDir, roots} of Object.values(
      config.workspaces
    )) {
      for (const root of Object.keys(roots)) {
        const rootPath = path.join(rootDir, contentDir, root)
        const contents = await filesOfPath(fs, rootPath)
        res.files.push(...contents.files)
        res.dirs.push(...contents.dirs)
      }
    }
    return res
  }

  async publish({changes}: Hub.ChangesParams) {
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

  async upload({fileLocation, buffer}: Hub.MediaUploadParams): Promise<string> {
    const {fs, rootDir = '.'} = this.options
    await fs.writeFile(path.join(rootDir, fileLocation), Buffer.from(buffer))
    return fileLocation
  }

  async download({location}: Hub.DownloadParams): Promise<Hub.Download> {
    const {fs, config, rootDir = '.'} = this.options
    const mediaDirs: Array<string> = Object.values(config.workspaces)
      .map(workspace => workspace.mediaDir!)
      .filter(Boolean)
    const file = path.join(rootDir, location)
    const isInMediaLocation = mediaDirs.some(dir =>
      path.contains(path.join(rootDir, dir), file)
    )
    if (!isInMediaLocation) throw createError(401)
    return {type: 'buffer', buffer: await fs.readFile(file)}
  }
}
