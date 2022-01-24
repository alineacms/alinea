import {Entry, Outcome, outcome} from '@alinea/core'
import path from 'path/posix'
import {FS} from './FS'

export interface Source {
  insert(entries: Array<Entry>): Promise<Outcome<void>>
  entries(): AsyncGenerator<Entry>
}

export interface Loader {
  extension: string
  parse(input: Buffer): Entry.Raw
  format(entry: Entry.Raw): Buffer
}

export class FileSource implements Source {
  constructor(
    protected fs: FS,
    protected dir: string,
    protected loader: Loader
  ) {}

  insert(entries: Array<Entry>): Promise<Outcome<void>> {
    return outcome(async () => {
      for (const entry of entries) {
        const {$path, $parent, $isContainer, ...data} = entry
        const file =
          entry.$path + ($isContainer ? 'index' : '') + this.loader.extension
        const location = path.join(this.dir, file)
        await this.fs.mkdir(path.dirname(location), {recursive: true})
        await this.fs.writeFile(location, this.loader.format(data))
      }
    })
  }

  async *entries(): AsyncGenerator<Entry> {
    const targets = ['/']
    while (targets.length > 0) {
      const target = targets.shift()!
      const files = await this.fs.readdir(path.join(this.dir, target))
      files.sort((a, b) => {
        if (a.startsWith('index.')) return -1
        if (b.startsWith('index.')) return 1
        return a.localeCompare(b)
      })
      let parentId: string | undefined = undefined
      for (const file of files) {
        const location = path.join(this.dir, target, file)
        const stat = await this.fs.stat(location)
        if (stat.isDirectory()) {
          targets.push(path.join(target, file))
        } else {
          const extension = path.extname(location)
          if (extension !== this.loader.extension) continue
          const name = path.basename(file, extension)
          const isIndex = name === 'index'
          const entry = this.loader.parse(await this.fs.readFile(location))
          yield {
            ...entry,
            $path: path.join(target, isIndex ? '' : name),
            $parent: parentId,
            $isContainer: isIndex
          }
          if (isIndex) parentId = entry.id
        }
      }
    }
  }
}
