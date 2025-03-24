import {suite} from '@alinea/suite'
import fs from 'node:fs/promises'
import {Index} from './Index.js'
import {ReadonlyTree} from './Tree.js'
import {MemorySource} from './source/MemorySource.js'
import demoTree from './test/demo.json' with {type: 'json'}

const test = suite(import.meta)

const tree = ReadonlyTree.fromFlat(demoTree)
const source = new MemorySource(tree)
const tree2 = tree.clone()
tree2.remove('pages/recipes')
const remote = new MemorySource(await tree2.compile())
const dir = 'test/demo'
const files = tree.index()
for (const [file, sha] of files) {
  const contents = await fs.readFile(`${dir}/${file}`)
  await source.addBlob(contents)
  await remote.addBlob(contents)
}
const index = new Index<{_id: string}>(source, ({parents, contents}) => {
  const data = JSON.parse(new TextDecoder().decode(contents))
  data._parentId = parents[0]?.document._id
  return data
})
await index.sync()

test('index', async () => {
  const entry = index.first(doc => doc._id === 'oi4qtV9YaXNRIUDT2s61Y')
  test.is(entry?._id, 'oi4qtV9YaXNRIUDT2s61Y')
})

test('sync with', async () => {
  await index.syncWith(remote)
  const entry = index.first(doc => doc._id === 'oi4qtV9YaXNRIUDT2s61Y')
  test.not.ok(entry)
})
