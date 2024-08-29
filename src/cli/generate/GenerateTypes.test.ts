import {suite} from '@alinea/suite'
import {generateHint} from 'alinea/cli/generate/GenerateTypes'
import {Hint} from 'alinea/core/Hint'
import {code} from 'alinea/core/util/CodeGen'

suite(import.meta, test => {
  test('string type', () => {
    const string = Hint.String()
    const type = String(generateHint(string))
    test.is(type, 'string')
  })

  test('number type', () => {
    const number = Hint.Number()
    const type = String(generateHint(number))
    test.is(type, 'number')
  })

  test('boolean type', () => {
    const boolean = Hint.Boolean()
    const type = String(generateHint(boolean))
    test.is(type, 'boolean')
  })

  test('record type', () => {
    const record = Hint.Object({
      field1: Hint.String()
    })
    const type = String(generateHint(record))
    test.is(type, `{\n  field1: string\n}`)
  })

  test('list type', () => {
    const list = Hint.Array(
      Hint.Union([
        Hint.Object({
          type: Hint.Literal('TypeA'),
          field1: Hint.String()
        }),
        Hint.Object({
          type: Hint.Literal('TypeB'),
          field1: Hint.String()
        })
      ])
    )
    const type = String(generateHint(list))
    test.is(
      type,
      code`
      Array<{
        type: "TypeA"
        field1: string
      } | {
        type: "TypeB"
        field1: string
      }>
    `.toString()
    )
  })
})
