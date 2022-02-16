import {
  Config,
  createError,
  createId,
  Entry,
  outcome,
  slugify
} from '@alinea/core'
import {posix as path} from 'path'
import {Data} from '../Data'
import {FS} from '../FS'
import {Loader} from '../Loader'
import {parentUrl, walkUrl} from '../util/Urls'

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
  constructor(protected options: FileDataOptions) {}

  // Todo: this does not use any parallelism so either do or switch to a
  // sync version which should perform better
  async *entries(): AsyncGenerator<Entry> {
    const {config, fs, loader, rootDir = '.'} = this.options
    for (const [workspace, {schema, contentDir, roots}] of Object.entries(
      config.workspaces
    )) {
      for (const root of Object.keys(roots)) {
        const targets = ['/']
        const parentIndex = new Map<string, string>()
        while (targets.length > 0) {
          const target = targets.shift()!
          const [files, err] = await outcome(
            fs.readdir(path.join(rootDir, contentDir, root, target))
          )
          if (!files) continue
          files.sort((a, b) => {
            if (a.startsWith('index.')) return -1
            if (b.startsWith('index.')) return 1
            return a.localeCompare(b)
          })
          for (const file of files) {
            const location = path.join(rootDir, contentDir, root, target, file)
            const stat = await fs.stat(location)
            if (stat.isDirectory()) {
              targets.push(path.join(target, file))
            } else {
              const extension = path.extname(location)
              if (extension !== loader.extension) continue
              const name = path.basename(file, extension)
              const isIndex = name === 'index'
              const entry = loader.parse(schema, await fs.readFile(location))
              const type = schema.type(entry.type)
              const url = path.join(target, isIndex ? '' : name)
              const parentPath = isIndex ? parentUrl(target) : target
              const parents = walkUrl(parentPath).map(
                url => parentIndex.get(url)!
              )
              if (isIndex) parentIndex.set(url, entry.id)
              if (!type) continue
              const res = {
                ...entry,
                workspace,
                root,
                url,
                index: entry.index || entry.id,
                parent: parents[parents.length - 1],
                parents,
                $isContainer: type.options.isContainer
              }
              yield res
            }
          }
        }
      }
    }
  }

  async publish(entries: Array<Entry>): Promise<void> {
    const {fs, config, loader, rootDir = '.'} = this.options
    for (const entry of entries) {
      const {
        workspace,
        url,
        parent: parent,
        $isContainer,
        $status,
        ...data
      } = entry
      const {schema, contentDir} = config.workspaces[workspace]
      const type = schema.type(entry.type)
      const file =
        entry.url +
        (type?.options.isContainer ? '/index' : '') +
        loader.extension
      const location = path.join(rootDir, contentDir, entry.root, file)
      await fs.mkdir(path.dirname(location), {recursive: true})
      await fs.writeFile(location, loader.format(schema, data))
    }
  }

  async upload(workspace: string, file: Data.Media.Upload): Promise<string> {
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

  async download(
    workspace: string,
    location: string
  ): Promise<Data.Media.Download> {
    const {fs, config, rootDir = '.'} = this.options
    const {mediaDir} = config.workspaces[workspace]
    if (!mediaDir) throw createError(500, 'Media directory not configured')
    const file = path.join(rootDir, mediaDir, location)
    if (!isChildOf(file, path.join(rootDir, mediaDir))) throw createError(401)
    return {type: 'buffer', buffer: await fs.readFile(file)}
  }
}
