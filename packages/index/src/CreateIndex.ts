import {createId, Draft, Entry, outcome} from '@alinea/core'
import convertHrtime from 'convert-hrtime'
import fs from 'fs-extra'
import {Store} from 'helder.store'
import pLimit from 'p-limit'
import {posix as path} from 'path'
import prettyMilliseconds from 'pretty-ms'

const openfile = pLimit(4)

async function completeEntry(
  entry: Entry,
  save: (entry: Entry) => Promise<void>
) {
  if (!entry.id) {
    const result = {id: createId(), ...(entry as any)}
    await save(result)
    return result
  }
  return entry
}

async function entryData(location: string) {
  const parsed = JSON.parse(
    await openfile(() => fs.readFile(location, 'utf-8'))
  )
  const entry = await completeEntry(parsed, (entry: Entry) => {
    return fs.writeFile(location, JSON.stringify(entry, null, '  '))
  })
  return entry
}

type Progress<T> = Promise<T> & {progress(): number}

async function index(dir: string, store: Store) {
  let total = 0
  async function process(target: string, parentId?: string) {
    const files = await fs.readdir(path.join(dir, target))
    const tasks = files.map(file => async () => {
      const stat = await fs.stat(path.join(dir, target, file))
      const localPath = path.join(target, file)
      const isContainer = stat.isDirectory()
      if (isContainer) {
        let entry = {}
        // Find entry data in path/index.json
        const indexLocation = path.join(dir, localPath, '/index.json')
        const hasIndex = await outcome.succeeds(
          fs.access(indexLocation, fs.constants.R_OK)
        )
        if (hasIndex) entry = await entryData(indexLocation)
        // Find entry data in path.json
        const namedLocation = path.join(dir, `${localPath}.json`)
        const hasNamedLocation = await outcome.succeeds(
          fs.access(namedLocation, fs.constants.R_OK)
        )
        if (hasNamedLocation) entry = await entryData(namedLocation)
        const parent = store.insert(Entry, {
          $path: localPath,
          $parent: parentId,
          $isContainer: true,
          $channel: '',
          title: file,
          ...entry
        })
        await process(localPath, parent.id)
      } else {
        total++
        try {
          const location = path.join(dir, localPath)
          const entry = await entryData(location)
          const name = path.basename(file, '.json')
          const isIndex = name === 'index'
          const dirStat = await outcome(fs.stat(path.join(dir, target, name)))
          const isNamedLocation =
            dirStat.isSuccess() && dirStat.data.isDirectory()
          const shouldBeIndexed = !isNamedLocation && (!isIndex || !parentId)
          if (shouldBeIndexed) {
            const entryPath = path.join(target, isIndex ? '' : name)
            store.insert(Entry, {
              $path: entryPath,
              $parent: parentId,
              ...entry
            })
          }
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
    store.delete(Entry)
    store.delete(Draft)
    const total = await index(path, store)
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
