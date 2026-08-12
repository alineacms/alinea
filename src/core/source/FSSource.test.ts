import demoTree from '#test/fixtures/demo.json' with {type: 'json'}
import {suite} from '@alinea/suite'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {CachedFSSource, FSSource} from './FSSource.js'
import {hashBlob} from './GitUtils.js'
import {ReadonlyTree} from './Tree.js'

const test = suite(import.meta)

test('compare', async () => {
  const dir = 'test/fixtures/demo'
  const fsSource = new FSSource(dir)
  const tree = ReadonlyTree.fromFlat(demoTree)
  const fsTree = await fsSource.getTree()
  const batch = fsTree.diff(tree)
  test.is(batch.changes.length, 0)
})

test('cached source invalidates its tree after applying changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-fs-source-'))
  try {
    const source = new CachedFSSource(dir)
    const before = await source.getTree()
    const contents = new TextEncoder().encode('Hello')
    const sha = await hashBlob(contents)

    await source.applyChanges({
      fromSha: before.sha,
      changes: [{op: 'add', path: 'hello.txt', sha, contents}]
    })

    const after = await source.getTree()
    test.is(after.getLeaf('hello.txt').sha, sha)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})
