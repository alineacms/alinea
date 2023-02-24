import {type} from 'alinea/core'
import {text} from 'alinea/input/text'
import {test} from 'uvu'

test('create', () => {
  const typeA = type(
    'typeA',
    <div>some info</div>,
    {fieldA: text('a'), fieldB: text('b')},
    {fieldX: text('b')}
  )
})

test.run()
