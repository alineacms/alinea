import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {chunkCookieValue, parseChunkedCookies} from './ChunkCookieValue.js'

test('Chunk value into multiple cookies', () => {
  const value = 'abc'
  const res = chunkCookieValue('foo', value, 10)
  assert.equal(res, [
    {name: 'foo', value: '1'},
    {name: 'foo-0', value: 'abc'}
  ])

  const res2 = chunkCookieValue('foo', value, 7)
  assert.equal(res2, [
    {name: 'foo', value: '2'},
    {name: 'foo-0', value: 'ab'},
    {name: 'foo-1', value: 'c'}
  ])

  const res3 = chunkCookieValue('foo', value, 6)
  assert.equal(res3, [
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
  assert.equal(parsed, 'abc')

  const res2 = chunkCookieValue('foo', value, 8)
  const parsed2 = parseChunkedCookies('foo', res2)
  assert.equal(parsed2, 'abc')

  const res3 = chunkCookieValue('foo', value, 7)
  const parsed3 = parseChunkedCookies('foo', res3)
  assert.equal(parsed3, 'abc')

  const parsed4 = parseChunkedCookies('foo', [
    {name: 'foo', value: '1'},
    {name: 'foo+entryId', value: 'nonsense'},
    {name: 'foo-0', value: 'abc'},
    {name: 'foo-1', value: 'def'}
  ])
  assert.equal(parsed4, 'abc')
})

test.run()
