import {suite} from '@alinea/suite'
import {DeepMap} from 'alinea/backend/util/DeepMap'

suite(import.meta, test => {
  test('Deepmap', () => {
    const map = new DeepMap()
    map.set(['a', 'b', 'c'], 1)
    test.ok(map.has(['a', 'b', 'c']))
    test.is(map.get(['a', 'b', 'c']), 1)
    map.set(['a', 'b', 'd'], 2)
    test.is(map.get(['a', 'b', 'd']), 2)
    test.is(map.size, 2)
    map.delete(['a', 'b', 'c'])
    test.not.ok(map.has(['a', 'b', 'c']))
    test.is(map.get(['a', 'b', 'c']), undefined)
    test.is(map.size, 1)
    map.clear()
    test.not.ok(map.has(['a', 'b', 'd']))
  })

  test('Deepmap iterators', () => {
    const map = new DeepMap()
    map.set(['a', 'b', 'c'], 1)
    map.set(['a', 'b', 'c', 'x'], 5)
    map.set(['a', 'b', 'd'], 2)
    const keys = [...map.keys()]
    test.equal(keys, [
      ['a', 'b', 'c'],
      ['a', 'b', 'c', 'x'],
      ['a', 'b', 'd']
    ])

    const values = [...map.values()]
    test.equal(values, [1, 5, 2])

    const entries = [...map.entries()]
    test.equal(entries, [
      [['a', 'b', 'c'], 1],
      [['a', 'b', 'c', 'x'], 5],
      [['a', 'b', 'd'], 2]
    ])
  })
})
