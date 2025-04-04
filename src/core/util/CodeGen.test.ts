import {suite} from '@alinea/suite'
import {code} from 'alinea/core/util/CodeGen'

const test = suite(import.meta)

test('dedent', () => {
  test.is(
    code`
      block {
        inner
      }
    `.toString(),
    'block {\n  inner\n}'
  )
})

test('indent insert', () => {
  const inner = 'a\nb'
  test.is(
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
  test.is(
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
