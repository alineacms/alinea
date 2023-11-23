import {DeepMap} from 'alinea/backend/util/DeepMap'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('Deepmap', () => {
  const map = new DeepMap()
  map.set(['a', 'b', 'c'], 1)
  assert.ok(map.has(['a', 'b', 'c']))
  assert.is(map.get(['a', 'b', 'c']), 1)
  map.set(['a', 'b', 'd'], 2)
  assert.is(map.get(['a', 'b', 'd']), 2)
  assert.is(map.size, 2)
  map.delete(['a', 'b', 'c'])
  assert.not.ok(map.has(['a', 'b', 'c']))
  assert.is(map.get(['a', 'b', 'c']), undefined)
  assert.is(map.size, 1)
  map.clear()
  assert.not.ok(map.has(['a', 'b', 'd']))
})

test('Deepmap iterators', () => {
  const map = new DeepMap()
  map.set(['a', 'b', 'c'], 1)
  map.set(['a', 'b', 'c', 'x'], 5)
  map.set(['a', 'b', 'd'], 2)
  const keys = [...map.keys()]
  assert.equal(keys, [
    ['a', 'b', 'c'],
    ['a', 'b', 'c', 'x'],
    ['a', 'b', 'd']
  ])

  const values = [...map.values()]
  assert.equal(values, [1, 5, 2])

  const entries = [...map.entries()]
  assert.equal(entries, [
    [['a', 'b', 'c'], 1],
    [['a', 'b', 'c', 'x'], 5],
    [['a', 'b', 'd'], 2]
  ])
})

test.run()
