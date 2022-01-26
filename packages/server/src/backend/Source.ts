import {Entry, Outcome, outcome} from '@alinea/core'
import path from 'path/posix'
import {FS} from './FS'

export interface Source {
  publish(entries: Array<Entry>): Promise<Outcome<void>>
  entries(): AsyncGenerator<Entry>
}

export interface Loader {
  extension: string
  parse(input: Buffer): Entry.Raw
  format(entry: Entry.Raw): Buffer
}

export type FileSourceOptions = {
  fs: FS
  dir: string
  loader: Loader
}

export class FileSource implements Source {
  constructor(protected options: FileSourceOptions) {}

  publish(entries: Array<Entry>): Promise<Outcome<void>> {
    const {fs, dir, loader} = this.options
    return outcome(async () => {
      for (const entry of entries) {
        const {$path, $parent, $isContainer, ...data} = entry
        const file =
          entry.$path + ($isContainer ? 'index' : '') + loader.extension
        const location = path.join(dir, file)
        await fs.mkdir(path.dirname(location), {recursive: true})
        await fs.writeFile(location, loader.format(data))
      }
    })
  }

  // Todo: this does not use any parallelism so either do or switch to a
  // sync version which should perform better
  async *entries(): AsyncGenerator<Entry> {
    const {fs, dir, loader} = this.options
    const targets = ['/']
    while (targets.length > 0) {
      const target = targets.shift()!
      const files = await fs.readdir(path.join(dir, target))
      files.sort((a, b) => {
        if (a.startsWith('index.')) return -1
        if (b.startsWith('index.')) return 1
        return a.localeCompare(b)
      })
      let parentId: string | undefined = undefined
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
            $path: path.join(target, isIndex ? '' : name),
            $parent: parentId,
            $isContainer: isIndex || undefined
          }
          if (isIndex) parentId = entry.id
        }
      }
    }
  }
}
