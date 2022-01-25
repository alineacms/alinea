import {
  createId,
  docFromEntry,
  Draft,
  Entry,
  outcome,
  Schema
} from '@alinea/core'
import convertHrtime from 'convert-hrtime'
import {constants} from 'fs'
import {Store} from 'helder.store'
import {fromUint8Array} from 'js-base64'
import pLimit from 'p-limit'
import {posix as path} from 'path'
import prettyMilliseconds from 'pretty-ms'
import * as Y from 'yjs'
import {FS} from '../../backend/FS'

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

async function entryData(fs: FS, location: string) {
  const parsed = JSON.parse(
    await openfile(() => fs.readFile(location, 'utf-8'))
  )
  const entry = await completeEntry(parsed, (entry: Entry) => {
    return fs.writeFile(location, JSON.stringify(entry, null, '  '))
  })
  return entry
}

type Progress<T> = Promise<T> & {progress(): number}

async function index(fs: FS, schema: Schema, dir: string, store: Store) {
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
          fs.access(indexLocation, constants.R_OK)
        )
        if (hasIndex) entry = await entryData(fs, indexLocation)
        // Find entry data in path.json
        const namedLocation = path.join(dir, `${localPath}.json`)
        const hasNamedLocation = await outcome.succeeds(
          fs.access(namedLocation, constants.R_OK)
        )
        if (hasNamedLocation) entry = await entryData(fs, namedLocation)
        const parent = store.insert(Entry, {
          $path: localPath,
          $parent: parentId,
          $isContainer: true,
          type: '',
          title: file,
          ...entry
        })
        await process(localPath, parent.id)
      } else {
        total++
        try {
          const location = path.join(dir, localPath)
          if (!location.endsWith('.json')) return
          const data = await entryData(fs, location)
          const name = path.basename(file, '.json')
          const isIndex = name === 'index'
          const dirStat = await outcome(fs.stat(path.join(dir, target, name)))
          const isNamedLocation =
            dirStat.isSuccess() && dirStat.value.isDirectory()
          const shouldBeIndexed = !isNamedLocation && (!isIndex || !parentId)
          if (shouldBeIndexed) {
            const entryPath = path.join(target, isIndex ? '' : name)
            const entry = {
              $path: entryPath,
              $parent: parentId,
              ...data
            }
            store.insert(Entry, entry)
            const type = schema.type(entry.type)
            if (type) {
              const yDoc = docFromEntry(type, entry)
              const doc = fromUint8Array(Y.encodeStateAsUpdate(yDoc))
              store.insert(Draft, {entry: entry.id, doc})
            }
          }
        } catch (e) {
          console.log(`Could not parse ${localPath} because:`)
          console.error(e)
        }
      }
    })
    await Promise.all(tasks.map(t => t()))
  }
  await process('/')
  return total
}

function init(
  fs: FS,
  schema: Schema,
  store: Store,
  path: string
): Progress<Store> {
  let progress = 0
  async function build(): Promise<Store> {
    const startTime = process.hrtime.bigint()
    console.log('Start indexing...')
    store.delete(Entry)
    store.delete(Draft)
    const total = await index(fs, schema, path, store)
    store.createIndex(Entry, '$path', [Entry.$path])
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

export function fillCache(fs: FS, schema: Schema, store: Store, path: string) {
  return init(fs, schema, store, path)
}
