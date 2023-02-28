import {schema, type} from 'alinea/core'
import {list} from 'alinea/input/list'
import {richText} from 'alinea/input/richtext'

export const ColumnsBlockSchema = type('Columns', {
  items: list('Items', {
    schema: schema({
      ColumnItem: type('Item', {
        text: richText('Text')
      })
    })
  })
})
