import {createId, Draft, Entry} from '@alinea/core'
import convertHrtime from 'convert-hrtime'
import {promises as fs} from 'fs'
import {Store} from 'helder.store'
import pLimit from 'p-limit'
import {posix as path} from 'path'
import prettyMilliseconds from 'pretty-ms'

async function completeEntry(
  entry: Entry,
  save: (entry: Entry) => Promise<void>
) {
  if (!entry.$id) return save({$id: createId(), ...(entry as any)})
}

type Progress<T> = Promise<T> & {progress(): number}

async function index(dir: string, store: Store) {
  let total = 0
  const openfile = pLimit(4)
  async function process(target: string, parentId?: string) {
    const files = await fs.readdir(path.join(dir, target))
    const tasks = files.map(file => async () => {
      const stat = await fs.stat(path.join(dir, target, file))
      const localPath = path.join(target, file)
      const isContainer = stat.isDirectory()
      if (isContainer) {
        const parent = store.insert(Entry, {
          $id: createId(),
          $path: localPath,
          $parent: parentId,
          $isContainer: true,
          $channel: '',
          title: file
        })
        await process(localPath, parent.$id)
      } else {
        total++
        try {
          const location = path.join(dir, localPath)
          const parsed = JSON.parse(
            await openfile(() => fs.readFile(location, 'utf-8'))
          )
          // Fill missing details
          await completeEntry(parsed, (entry: Entry) => {
            return fs.writeFile(location, JSON.stringify(entry, null, '  '))
          })
          const name = path.basename(file, '.json')
          const entryPath = path.join(target, name === 'index' ? '' : name)
          store.insert(Entry, {
            $id: parsed.$id || createId(),
            $path: entryPath,
            $parent: parentId,
            ...parsed
          })
        } catch (e) {
          console.log(`Could not parse ${localPath} because:\n  ${e}`)
        }
      }
    })
    await Promise.all(tasks.map(t => t()))
  }
  await process('/')
  return total
}

function init(store: Store, path: string): Progress<Store> {
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

export function createIndex(store: Store, path: string) {
  return init(store, path)
}
