import {suite} from '@alinea/suite'
import {MemorySource} from './MemorySource.js'
import {SourceTransaction, sourceFromTree} from './Source.js'
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
