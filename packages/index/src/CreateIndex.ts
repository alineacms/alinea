import {createId, Draft, Entry} from '@alinea/core'
import convertHrtime from 'convert-hrtime'
import {promises} from 'fs'
import {Store} from 'helder.store'
import pLimit from 'p-limit'
import prettyMilliseconds from 'pretty-ms'

function join(...parts: Array<string>) {
  return parts.join('/')
}

type Progress<T> = Promise<T> & {progress(): number}

async function index(path: string, store: Store) {
  let total = 0
  const openfile = pLimit(4)
  async function process(target: string, parentId?: string) {
    const files = await promises.readdir(join(path, target))
    const tasks = files.map(file => async () => {
      const stat = await promises.stat(join(path, target, file))
      const localPath = join(target, file)
      const isContainer = stat.isDirectory()
      if (isContainer) {
        const parent = store.insert(Entry, {
          $id: createId(),
          $parent: parentId,
          //path: localPath,
          $isContainer: true,
          $channel: '',
          title: file
        })
        await process(localPath, parent.$id)
      } else {
        total++
        try {
          const parsed = JSON.parse(
            await openfile(() =>
              promises.readFile(join(path, localPath), 'utf-8')
            )
          )
          store.insert(Entry, {
            $id: parsed.$id || createId(),
            $parent: parentId,
            $channel: parsed.channel,
            ...parsed
          })
        } catch (e) {
          console.log(`Could not parse ${localPath} because:\n  ${e}`)
        }
      }
    })
    await Promise.all(tasks.map(t => t()))
  }
  await process('')
  return total
}

function init(store: Store, path: string): Progress<Store> {
  // Check if the index exists, if not build it
  let progress = 0
  async function build(): Promise<Store> {
    const startTime = process.hrtime.bigint()
    console.log('Start indexing...')
    const total = await index(path, store)
    store.createIndex(Entry, '$id', [Entry.$id])
    store.createIndex(Entry, '$parent', [Entry.$parent])
    store.createIndex(Draft, 'entry', [Draft.entry])
    const diff = process.hrtime.bigint() - startTime
    console.log(
      `Done indexing ${total} entries in ${prettyMilliseconds(
        convertHrtime(diff).milliseconds
      )}`
    )
    return store
  }
  return Object.assign(build(), {progress: () => progress})
}

// const store = new SqliteStore(new BetterSqlite3())

export function createIndex(store: Store, path: string) {
  return init(store, path)
}
