import {generateHint} from 'alinea/cli/generate/GenerateTypes'
import {Hint} from 'alinea/core/Hint'
import {code} from 'alinea/core/util/CodeGen'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('string type', () => {
  const string = Hint.String()
  const type = String(generateHint(string))
  assert.is(type, 'string')
})

test('number type', () => {
  const number = Hint.Number()
  const type = String(generateHint(number))
  assert.is(type, 'number')
})

test('boolean type', () => {
  const boolean = Hint.Boolean()
  const type = String(generateHint(boolean))
  assert.is(type, 'boolean')
})

test('record type', () => {
  const record = Hint.Object({
    field1: Hint.String()
  })
  const type = String(generateHint(record))
  assert.is(type, `{\n  field1: string\n}`)
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
  assert.is(
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

/*
const workspace1 = new Workspace(
  'test',
  workspace('Test', {
    source: './irrelevant',
    roots: {},
    schema: schema({
      TypeA: type('TypeA', {
        title: text('Title'),
        path: path('Path'),
        stringField: text('Text field'),
        numberField: number('Text field'),
        listField: list('List field', {
          schema: schema({
            Block1: type('Block 1', {
              blockField1: text('Block field 1')
            })
          })
        }),
        richText1: richText('Rich text'),
        richText2: richText('Rich text', {
          blocks: schema({
            Block1: type('Block 1', {
              blockField1: text('Block field 1')
            }),
            Block2: type('Block 2', {
              blockField1: text('Block 2 field 1')
            })
          })
        })
      })
    })
  })
)

test('type gen', async () => {
  const types = generateTypes(workspace1)
  assert.is(true, true)
})
*/

test.run()
