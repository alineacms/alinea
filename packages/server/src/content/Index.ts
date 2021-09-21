import {Content, Entry, Hub, Label} from '../../../core/src/Hub'
import {Collection, SqliteStore, Store} from 'helder.store'
import {BetterSqlite3} from 'helder.store/drivers/BetterSqlite3'
import {constants, promises} from 'fs'
import prettyMilliseconds from 'pretty-ms'
import convertHrtime from 'convert-hrtime'
import {basename} from 'path'

function join(...parts: Array<string>) {
  return parts.join('/')
}

const Entry = new Collection<Entry>('Entry')

type Progress<T> = Promise<T> & {progress(): number}

async function index(path: string, store: Store) {
  async function process(target: string) {
    let total = 0
    const files = await promises.readdir(join(path, target))
    for (const file of files) {
      const stat = await promises.stat(join(path, target, file))
      const localPath = join(target, file)
      const isContainer = stat.isDirectory()
      if (isContainer) {
        total += await process(localPath)
        store.insert(Entry, {
          path: localPath,
          isContainer: true,
          title: file,
          parent: target ? target : undefined
        })
      } else {
        try {
          total++
          store.insert(Entry, {
            ...JSON.parse(
              await promises.readFile(join(path, localPath), 'utf-8')
            ),
            path: localPath,
            parent: target ? target : undefined
          })
        } catch (e) {
          console.log(`Could not parse ${localPath}`)
        }
      }
    }
    return total
  }
  return await process('')
}

function init(path: string): Progress<Content> {
  // Check if the index exists, if not build it
  let progress = 0
  async function build(): Promise<Content> {
    const startTime = process.hrtime.bigint()
    const store = new SqliteStore(new BetterSqlite3())
    console.log('Start indexing...')
    const total = await index(path, store)
    store.createIndex(Entry, 'parent', [Entry.parent])
    store.createIndex(Entry, 'path', [Entry.path])
    const diff = process.hrtime.bigint() - startTime
    console.log(
      `Done indexing ${total} entries in ${prettyMilliseconds(
        convertHrtime(diff).milliseconds
      )}`
    )
    return new Indexed(store)
  }
  return Object.assign(build(), {progress: () => progress})
}

class Indexed implements Content {
  constructor(protected store: Store) {}

  async get(path: string): Promise<Entry | null> {
    return this.store.first(Entry.where(Entry.path.is(path)))
  }

  async list(path?: string): Promise<Array<Entry>> {
    return this.store.all(
      Entry.where(path ? Entry.parent.is(path) : Entry.parent.isNull()).select({
        path: Entry.path,
        isContainer: Entry.isContainer,
        parent: Entry.parent,
        title: Entry.title
      })
    )
  }
}

export class Index implements Content {
  index = init(this.path)

  constructor(protected path: string) {}

  get(path: string): Promise<Entry | null> {
    return this.index.then(index => index.get(path))
  }

  list(path?: string): Promise<Array<Entry>> {
    return this.index.then(index => index.list(path))
  }
}
