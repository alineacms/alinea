import {generateHint} from '@alinea/cli/generate/GenerateTypes'
import {Hint} from '@alinea/core/Hint'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('string type', () => {
  const string = Hint.String()
  const type = generateHint(string)
  assert.is(type, 'string')
})

test('number type', () => {
  const number = Hint.Number()
  const type = generateHint(number)
  assert.is(type, 'number')
})

test('boolean type', () => {
  const boolean = Hint.Boolean()
  const type = generateHint(boolean)
  assert.is(type, 'boolean')
})

test('record type', () => {
  const record = Hint.Object({
    field1: Hint.String()
  })
  const type = generateHint(record)
  assert.is(type, `{'field1': string}`)
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
  const type = generateHint(list)
  assert.is(
    type,
    `Array<{'type': 'TypeA', 'id': string, 'index': string, 'field1': string} | {'type': 'TypeB', 'id': string, 'index': string, 'field1': string}>`
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
