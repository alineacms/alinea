import {suite} from '@alinea/suite'
import {chunkCookieValue} from './ChunkCookieValue.js'

suite(import.meta, test => {
  test('Chunk value into multiple cookies', () => {
    const value = 'abc'
    const res = chunkCookieValue('foo', value, 10)
    test.equal(res, [
      {name: 'foo', value: '1'},
      {name: 'foo-0', value: 'abc'}
    ])

    const res2 = chunkCookieValue('foo', value, 7)
    test.equal(res2, [
      {name: 'foo', value: '2'},
      {name: 'foo-0', value: 'ab'},
      {name: 'foo-1', value: 'c'}
    ])

    const res3 = chunkCookieValue('foo', value, 6)
    test.equal(res3, [
      {name: 'foo', value: '3'},
      {name: 'foo-0', value: 'a'},
      {name: 'foo-1', value: 'b'},
      {name: 'foo-2', value: 'c'}
    ])
  })
})
