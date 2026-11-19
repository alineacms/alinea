import {suite} from '@alinea/suite'
import {MemorySource} from './MemorySource.js'
import {hashBlob} from './GitUtils.js'
import {type Source, SourceTransaction, sourceFromTree} from './Source.js'
import {ReadonlyTree} from './Tree.js'

const test = suite(import.meta)
const encoder = new TextEncoder()

test('compiles incremental changes against a previous tree', async () => {
  const source = new MemorySource()
  const initial = await source.getTree()
  const transaction = new SourceTransaction(source, initial)
  transaction.add('one.txt', encoder.encode('one'))
  const first = await transaction.compile(initial)

  transaction.add('two.txt', encoder.encode('two'))
  const second = await transaction.compile(first.into)

  test.is(second.from, first.into)
  test.equal(
    second.changes.map(change => change.path),
    ['two.txt']
  )

  const complete = await transaction.compile()
  test.is(complete.from, initial)
  test.equal(
    complete.changes.map(change => change.path),
    ['one.txt', 'two.txt']
  )
})

test('a moved file takes the hash of the bytes the source returns', async () => {
  const source = new MemorySource()
  const pretty = encoder.encode('{\n  "title": "Child"\n}')
  const initial = await source.getTree()
  const created = new SourceTransaction(source, initial)
  created.add('parent/child.json', pretty)
  const {changes} = await created.compile()
  await source.applyChanges({fromSha: initial.sha, changes})
  // Like a database without the original file: the same entry, serialized
  // again
  const compact = encoder.encode('{"title":"Child"}')
  const reserializing: Source = {
    getTree: () => source.getTree(),
    getTreeIfDifferent: sha => source.getTreeIfDifferent(sha),
    async *getBlobs(shas) {
      for (const sha of shas) yield [sha, compact]
    },
    applyChanges: batch => source.applyChanges(batch)
  }
  const tree = await source.getTree()
  const transaction = new SourceTransaction(reserializing, tree)
  transaction.rename('parent', 'renamed')
  const result = await transaction.compile()

  const added = result.changes.find(change => change.op === 'add')
  test.equal(added?.path, 'renamed/child.json')
  test.equal(added?.sha, await hashBlob(compact))
  test.equal(added?.op === 'add' && added.contents, compact)
  test.equal(result.into.get('renamed/child.json')?.sha, added?.sha)
  // The tree is the one a git commit of these changes holds
  await source.applyChanges({fromSha: tree.sha, changes: result.changes})
  test.equal((await source.getTree()).sha, result.into.sha)
})

test('applies a fetched tree only to the revision it was fetched against', async () => {
  const source = new MemorySource()
  const stale = new ReadonlyTree({sha: 'stale', entries: []})
  const from = sourceFromTree(source, 'from', stale)
  test.is(await from.getTreeIfDifferent('from'), stale)
  test.is(await from.getTreeIfDifferent('stale'), undefined)
  // A store that moved on meanwhile is answered by the source itself
  const latest = await source.getTree()
  test.is((await from.getTreeIfDifferent('elsewhere'))?.sha, latest.sha)
})
