import {suite} from '@alinea/suite'
import demoTree from '../../test/demo.json' with {type: 'json'}
import {ReadonlyTree} from '../Tree.ts'
import {FSSource} from './FSSource.ts'

const test = suite(import.meta)

test('compare', async () => {
  const dir = 'test/demo'
  const fsSource = new FSSource(dir)
  const tree = ReadonlyTree.fromFlat(demoTree)
  const fsTree = await fsSource.getTree()
  const diff = fsTree.diff(tree)
  test.is(diff.length, 0)
})
