import {code} from 'alinea/core/util/CodeGen'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('dedent', () => {
  assert.is(
    code`
      block {
        inner
      }
    `.toString(),
    'block {\n  inner\n}'
  )
})

test('indent insert', () => {
  const inner = `a\nb`
  assert.is(
    code`
      block {
        ${inner}
      }
    `.toString(),
    'block {\n  a\n  b\n}'
  )
})

test('indent indent after chars', () => {
  const type = code`
    {
      a: 1
      b: 2
    }
  `
  assert.is(
    code`
      block {
        property: ${type}
      }
    `.toString(),
    'block {\n' +
      '  property: {\n' +
      '    a: 1\n' +
      '    b: 2\n' +
      '  }\n' +
      '}'
  )
})

test.run()
