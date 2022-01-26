import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {createId, parseId} from '../src'

test('create', () => {
  const id = createId()
  assert.ok(id.length === 27)
})

test('inspect', () => {
  const id = '0ujtsYcgvSTl8PAuAdqWYSMnLOv'
  const [time, payload] = parseId(id)
  assert.is(time.getTime(), 1507608047000)
  assert.is(
    Buffer.from(payload).toString('hex'),
    'B5A1CD34B5F99D1154FB6853345C9735'.toLowerCase()
  )
})

test('inspect', () => {
  const id = '0ujzPyRiIAffKhBux4PvQdDqMHY'
  const [time, payload] = parseId(id)
  assert.is(time.getTime(), 1507610780000)
  assert.is(
    Buffer.from(payload).toString('hex'),
    '73FC1AA3B2446246D6E89FCD909E8FE8'.toLowerCase()
  )
})

test.run()
