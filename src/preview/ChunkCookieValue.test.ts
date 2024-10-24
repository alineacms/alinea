import {suite} from '@alinea/suite'
import {chunkCookieValue, parseChunkedCookies} from './ChunkCookieValue.js'

suite(import.meta, test => {
  test('Chunk value into multiple cookies', () => {
    const value = 'abc'
    const res = chunkCookieValue('foo', value, 10)
    test.equal(res, [
      {name: 'foo', value: '1'},
      {name: 'foo-0', value: 'abc'}
    ])

    const res2 = chunkCookieValue('foo', value, 8)
    test.equal(res2, [
      {name: 'foo', value: '2'},
      {name: 'foo-0', value: 'ab'},
      {name: 'foo-1', value: 'c'}
    ])

    const res3 = chunkCookieValue('foo', value, 7)
    test.equal(res3, [
      {name: 'foo', value: '3'},
      {name: 'foo-0', value: 'a'},
      {name: 'foo-1', value: 'b'},
      {name: 'foo-2', value: 'c'}
    ])
  })

  test('Parse chunked cookie values', () => {
    const value = 'abc'
    const res = chunkCookieValue('foo', value, 10)
    const parsed = parseChunkedCookies('foo', res)
    test.equal(parsed, 'abc')

    const res2 = chunkCookieValue('foo', value, 8)
    const parsed2 = parseChunkedCookies('foo', res2)
    test.equal(parsed2, 'abc')

    const res3 = chunkCookieValue('foo', value, 7)
    const parsed3 = parseChunkedCookies('foo', res3)
    test.equal(parsed3, 'abc')

    const parsed4 = parseChunkedCookies('foo', [
      {name: 'foo', value: '1'},
      {name: 'foo+entryId', value: 'nonsense'},
      {name: 'foo-0', value: 'abc'},
      {name: 'foo-1', value: 'def'}
    ])
    test.equal(parsed4, 'abc')
  })
})
