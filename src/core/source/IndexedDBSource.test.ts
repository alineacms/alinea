import fs from 'node:fs/promises'
import {suite} from '@alinea/suite'
import {indexedDB} from 'fake-indexeddb'
import demoTree from '#test/fixtures/demo.json' with {type: 'json'}
import {accumulate} from '../util/Async.js'
import {MemorySource} from './MemorySource.js'
import {syncWith} from './Source.js'
import {ReadonlyTree} from './Tree.js'

const test = suite(import.meta)

const tree = ReadonlyTree.fromFlat(demoTree)
const memorySource = new MemorySource(tree)
const dir = 'test/fixtures/demo'
const files = tree.index()
const blobs = new Map<string, Uint8Array>()
for (const [file, sha] of files) {
  const contents = await fs.readFile(`${dir}/${file}`)
  await memorySource.addBlob(contents)
  blobs.set(sha, contents)
}

test('indexeddb source', async () => {
  const {IndexedDBSource} = await import('./IndexedDBSource.js')
  const idbSource = new IndexedDBSource(indexedDB, 'test')
  await syncWith(idbSource, memorySource)
  const fromSource = new Map(
    await accumulate(idbSource.getBlobs([...blobs.keys()]))
  )
  test.equal(fromSource, blobs)
  for (const [sha, contents] of blobs) {
    const [[, fromSourceBlob]] = await accumulate(idbSource.getBlobs([sha]))
    test.equal(fromSourceBlob, contents)
  }
  await test.throws(
    () => accumulate(idbSource.getBlobs(['missing'])),
    'Blob not found: missing'
  )
  const idbTree = await idbSource.getTree()
  test.ok(idbTree.equals(tree))
})
