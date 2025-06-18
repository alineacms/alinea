import {suite} from '@alinea/suite'
import demoTree from '../../test/fixtures/demo.json' with {type: 'json'}
import {FSSource} from './FSSource.js'
import {ReadonlyTree} from './Tree.js'

const test = suite(import.meta)

test('compare', async () => {
  const dir = 'apps/web/content/demo'
  const fsSource = new FSSource(dir)
  const tree = ReadonlyTree.fromFlat(demoTree)
  const fsTree = await fsSource.getTree()
  const batch = fsTree.diff(tree)
  test.is(batch.changes.length, 0)
})
