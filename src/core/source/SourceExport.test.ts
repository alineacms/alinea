import {suite} from '@alinea/suite'
import {FSSource} from './FSSource.js'
import {exportSource, importSource} from './SourceExport.js'

const test = suite(import.meta)

const dir = 'apps/web/content/demo'
const fsSource = new FSSource(dir)

test('export/import', async () => {
  const tree = await fsSource.getTree()
  const exported = JSON.stringify(await exportSource(fsSource))
  const imported = await importSource(JSON.parse(exported))
  const exportedTree = await imported.getTree()
  test.ok(tree.equals(exportedTree))
  for (const [file, sha] of tree.index()) {
    const [fromSource] = await fsSource.getBlobs([sha])
    const [fromImport] = await imported.getBlobs([sha])
    test.equal(fromSource[1], fromImport[1])
  }
})
