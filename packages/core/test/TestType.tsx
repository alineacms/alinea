import {text} from '@alineacms/input.text'
import {test} from 'uvu'
import {type} from '../src'

test('create', () => {
  const typeA = type(
    'typeA',
    <div>some info</div>,
    {fieldA: text('a'), fieldB: text('b')},
    {fieldX: text('b')}
  )
})

test.run()
