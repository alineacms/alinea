import {Field, type, Type} from 'alinea/core'
import {list, text} from 'alinea/input'

const TypeA = type({
  fieldA: text('Field A'),
  fieldB: text('Field B'),
  listA: list('List', {
    schema: {
      Row: type({
        sharedFieldA: text('Shared Field A', {shared: true})
      })
    }
  })
})

import {test} from 'uvu'

test('Extract fields', async () => {
  const fieldData = Type.extractPatch(
    TypeA,
    {
      fieldA: 'Field A',
      fieldB: 'Field B',
      listA: [
        {
          id: 'abc',
          type: 'Row',
          sharedFieldA: 'Shared Field A'
        }
      ]
    },
    field => {
      return Field.options(field).shared
    }
  )
  console.log(fieldData)
})

test.run()
