import {Entry} from '@alinea/core'
import {posix as path} from 'path'
import {FS} from './FS'
import {Loader} from './Loader'
import {Target} from './Target'

export interface Source {
  entries(): AsyncGenerator<Entry>
}

export type FileSourceOptions = {
  fs: FS
  dir: string
  loader: Loader
}

export class FileSource implements Source, Target {
  constructor(protected options: FileSourceOptions) {}

  async publish(entries: Array<Entry>): Promise<void> {
    const {fs, dir, loader} = this.options
    for (const entry of entries) {
      const {url, $parent, $isContainer, ...data} = entry
      const file = entry.url + ($isContainer ? 'index' : '') + loader.extension
      const location = path.join(dir, file)
      await fs.mkdir(path.dirname(location), {recursive: true})
      await fs.writeFile(location, loader.format(data))
    }
  }

  // Todo: this does not use any parallelism so either do or switch to a
  // sync version which should perform better
  async *entries(): AsyncGenerator<Entry> {
    const {fs, dir, loader} = this.options
    const targets = ['/']
    let parentId: string | undefined = undefined
    while (targets.length > 0) {
      const target = targets.shift()!
      const files = await fs.readdir(path.join(dir, target))
      files.sort((a, b) => {
        if (a.startsWith('index.')) return -1
        if (b.startsWith('index.')) return 1
        return a.localeCompare(b)
      })
      for (const file of files) {
        const location = path.join(dir, target, file)
        const stat = await fs.stat(location)
        if (stat.isDirectory()) {
          targets.push(path.join(target, file))
        } else {
          const extension = path.extname(location)
          if (extension !== loader.extension) continue
          const name = path.basename(file, extension)
          const isIndex = name === 'index'
          const entry = loader.parse(await fs.readFile(location))
          yield {
            ...entry,
            url: path.join(target, isIndex ? '' : name),
            $parent: parentId,
            $isContainer: isIndex || undefined
          }
          if (isIndex) parentId = entry.id
        }
      }
    }
  }
}
