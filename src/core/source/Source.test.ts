import {suite} from '@alinea/suite'
import {MemorySource} from './MemorySource.js'
import {SourceTransaction} from './Source.js'

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
