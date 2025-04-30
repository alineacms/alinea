import fs from 'node:fs/promises'
import {suite} from '@alinea/suite'
import demoTree from '../../test/demo.json' with {type: 'json'}
import {ReadonlyTree} from '../source/Tree.js'
import {MemorySource} from './MemorySource.js'

const test = suite(import.meta)

test('memory source', async () => {
  const tree = ReadonlyTree.fromFlat(demoTree)
  const source = new MemorySource(tree)
  const dir = 'apps/web/content/demo'
  const files = tree.index()
  for (const [file, sha] of files) {
    const contents = await fs.readFile(`${dir}/${file}`)
    await source.addBlob(contents)
  }
})
