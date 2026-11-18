/**
 * Measures the sync of a move: the page with the most descendants moves
 * below another page, in every locale, in the generated site of the initial
 * sync bench. The index syncs from an in-memory source, so this times
 * reading the changed files and deriving the entries, without a network.
 *
 *   bun test/bench/move.ts [files]
 */
import type {Change} from '#/core/source/Change.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {DatabaseSource} from '#/database/DatabaseSource.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {openWasmDatabase} from '#/database/driver/WasmDatabase.js'
import {cms, locales} from './initial-sync.cms.js'
import {content} from './initial-sync.content.js'

const size = Number(process.argv[2] ?? 20_000)
const {config} = cms
const files = new Map(content(size).map(file => [file.path, file.contents]))

async function add(path: string, contents: Uint8Array): Promise<Change> {
  return {op: 'add', path, sha: await hashBlob(contents), contents}
}

/** The changes that move the largest page below the second largest. */
async function move(): Promise<{changes: Array<Change>; label: string}> {
  const descendants = new Map<string, number>()
  for (const path of files.keys()) {
    const match = /^(pages\/en\/[^/]+)\//.exec(path)
    if (match) descendants.set(match[1], (descendants.get(match[1]) ?? 0) + 1)
  }
  const [[from, count], [into]] = [...descendants].sort((a, b) => b[1] - a[1])
  const changes = Array<Promise<Change>>()
  let moved = 0
  for (const locale of locales) {
    const local = (path: string) =>
      path.replace(/^pages\/en\/en-/, `pages/${locale}/${locale}-`)
    const source = local(from)
    const target = `${local(into)}/${source.slice(source.lastIndexOf('/') + 1)}`
    for (const [path, contents] of files) {
      if (path !== `${source}.json` && !path.startsWith(`${source}/`)) continue
      moved++
      changes.push(
        hashBlob(contents).then((sha): Change => ({op: 'delete', path, sha})),
        add(target + path.slice(source.length), contents)
      )
    }
  }
  const label = `move ${moved} files: a page with ${count} descendants, in ${locales.length} locales`
  return {changes: await Promise.all(changes), label}
}

const source = new MemorySource()
await source.applyChanges({
  fromSha: ReadonlyTree.EMPTY.sha,
  changes: await Promise.all(
    Array.from(files, ([path, contents]) => add(path, contents))
  )
})
let blobs = 0
const counting: RemoteSource = {
  getTreeIfDifferent: sha => source.getTreeIfDifferent(sha),
  async *getBlobs(shas, options) {
    blobs += shas.length
    yield* source.getBlobs(shas, options)
  }
}
const {database: db, fork} = await openWasmDatabase()
await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
const database = new EntryDatabase(config, db, {fork})
const store = new EntryStore(config, database, new DatabaseSource(database), {
  ownsDatabase: true,
  sourceFollowsDatabase: true
})
let start = performance.now()
await store.syncWith(counting, {validate: false})
console.log(
  `index ${files.size} files`.padEnd(70),
  `${(performance.now() - start).toFixed(0).padStart(6)} ms`
)
for (let round = 0; round < 3; round++) {
  const {changes, label} = await move()
  const tree = await source.getTree()
  await source.applyChanges({fromSha: tree.sha, changes})
  for (const change of changes)
    if (change.op === 'delete') files.delete(change.path)
  for (const change of changes)
    if (change.op === 'add') files.set(change.path, change.contents!)
  blobs = 0
  start = performance.now()
  await store.syncWith(counting, {validate: false})
  console.log(
    label.padEnd(70),
    `${(performance.now() - start).toFixed(0).padStart(6)} ms, ${blobs} blobs read`
  )
}
await store.close()
