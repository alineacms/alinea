import {generateHint, generateTypes} from '@alinea/cli/generate/GenerateTypes'
import {schema} from '@alinea/core/Schema'
import {Shape} from '@alinea/core/Shape'
import {type} from '@alinea/core/Type'
import {Workspace, workspace} from '@alinea/core/Workspace'
import {list} from '@alinea/input.list'
import {number} from '@alinea/input.number'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {text} from '@alinea/input.text'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('string type', () => {
  const string = Shape.String('String')
  const type = generateHint(string.hint)
  assert.is(type, 'string')
})

test('number type', () => {
  const number = Shape.Number('Number')
  const type = generateHint(number.hint)
  assert.is(type, 'number')
})

test('boolean type', () => {
  const boolean = Shape.Boolean('Boolean')
  const type = generateHint(boolean.hint)
  assert.is(type, 'boolean')
})

test('record type', () => {
  const record = Shape.Record('TypeA', {
    field1: Shape.String('String')
  })
  const type = generateHint(record.hint)
  assert.is(type, `{'field1': string}`)
})

test('list type', () => {
  const list = Shape.List('List', {
    TypeA: Shape.Record('TypeA', {
      field1: Shape.String('String')
    }),
    TypeB: Shape.Record('TypeB', {
      field1: Shape.String('String')
    })
  })
  const type = generateHint(list.hint)
  assert.is(
    type,
    `Array<{'type': 'TypeA', 'id': string, 'index': string, 'field1': string} | {'type': 'TypeB', 'id': string, 'index': string, 'field1': string}>`
  )
})

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

test.run()
