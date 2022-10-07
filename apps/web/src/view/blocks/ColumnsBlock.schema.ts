import {schema, Schema, type} from '@alinea/core'
import {list} from '@alinea/input.list'
import {richText} from '@alinea/input.richtext'
import {ComponentType} from 'react'

export const ColumnsBlockSchema = type('Columns', {
  items: list('Items', {
    schema: schema({
      ColumnItem: type('Item', {
        text: richText('Text')
      })
    })
  })
})

export type ColumnsBlockSchema = Schema.TypeOf<typeof ColumnsBlockSchema> & {
  id: string
  type: 'ColumnsBlock'
  container?: ComponentType
}
