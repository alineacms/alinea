import {suite} from '@alinea/suite'
import {accumulate} from '../util/Async.js'
import {FSSource} from './FSSource.js'
import {exportSourcePack, importSourcePack} from './SourcePack.js'

const test = suite(import.meta)

test('export and import an indexed source pack', async () => {
  const source = new FSSource('test/fixtures/demo')
  const expectedTree = await source.getTree()
  const packed = await exportSourcePack(source)
  const imported = await importSourcePack(packed)
  const actualTree = await imported.getTree()
  test.ok(expectedTree.equals(actualTree))
  for (const [, sha] of expectedTree.index()) {
    const [expected] = await accumulate(source.getBlobs([sha]))
    const [actual] = await accumulate(imported.getBlobs([sha]))
    test.equal(expected[1], actual[1])
  }
})
