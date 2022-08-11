import {
  Config,
  createError,
  createId,
  Entry,
  EntryStatus,
  Hub,
  outcome,
  slugify
} from '@alinea/core'
import {posix as path} from 'node:path'
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

// https://stackoverflow.com/a/45242825
function isChildOf(child: string, parent: string) {
  const relative = path.relative(parent, child)
  const isSubdir =
    relative && !relative.startsWith('..') && !path.isAbsolute(relative)
  return isSubdir
}

export class FileData implements Data.Source, Data.Target, Data.Media {
  canRename = true

  constructor(public options: FileDataOptions) {}

  async *entries(): AsyncGenerator<Entry> {
    const {config, fs, loader, rootDir = '.'} = this.options
    for (const [
      workspace,
      {schema, source: contentDir, roots}
    ] of Object.entries(config.workspaces)) {
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
                const [entry, err] = outcome(() => loader.parse(schema, buffer))
                if (!entry) {
                  console.log(`\rCould not parse ${location}: ${err}`)
                  continue
                }
                if (locale && !entry.alinea.i18n) {
                  console.log(
                    `\rNo i18n id found for entry with id ${entry.id}`
                  )
                  continue
                }
                const type = schema.type(entry.type)
                if (!type) continue
                const isContainer = Boolean(type.options.isContainer)
                const url = path.join(target, isIndex ? '' : name)
                const parentPath = target
                const parents = walkUrl(parentPath)
                  .map(url => parentIndex.get(url)!)
                  .filter(Boolean)
                const parent = parents[parents.length - 1]
                const res: Entry = {
                  ...entry,
                  path: name,
                  url,
                  alinea: {
                    workspace,
                    root: root.name,
                    index:
                      entry.alinea?.index ||
                      // Todo: this is for backwards compatibility, should
                      // deprecate next major version
                      (entry as any).index ||
                      entry.id,
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
    const {config, rootDir = '.'} = this.options
    const paths = []
    for (const {source: contentDir, roots} of Object.values(
      config.workspaces
    )) {
      for (const root of Object.keys(roots)) {
        const rootPath = path.join(rootDir, contentDir, root)
        paths.push(rootPath)
      }
    }
    return paths
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

  async upload({workspace, ...file}: Hub.UploadParams): Promise<string> {
    const {fs, config, rootDir = '.'} = this.options
    const {mediaDir} = config.workspaces[workspace]
    if (!mediaDir) throw createError(500, 'Media directory not configured')
    const dir = path.dirname(file.path)
    const extension = path.extname(file.path)
    const name = path.basename(file.path, extension)
    const fileName = `${slugify(name)}.${createId()}${extension}`
    const location = path.join(rootDir, mediaDir, dir, fileName)
    await fs.mkdir(path.join(rootDir, mediaDir, dir), {recursive: true})
    await fs.writeFile(location, Buffer.from(file.buffer))
    return path.join(dir, fileName)
  }

  async download({
    workspace,
    location
  }: Hub.DownloadParams): Promise<Hub.Download> {
    const {fs, config, rootDir = '.'} = this.options
    const {mediaDir} = config.workspaces[workspace]
    if (!mediaDir) throw createError(500, 'Media directory not configured')
    const file = path.join(rootDir, mediaDir, location)
    if (!isChildOf(file, path.join(rootDir, mediaDir))) throw createError(401)
    return {type: 'buffer', buffer: await fs.readFile(file)}
  }
}
