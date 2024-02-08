import {Config, Field} from 'alinea'

export const ColumnsBlock = Config.type('Columns', {
  fields: {
    items: Field.list('Items', {
      schema: {
        ColumnItem: Config.type('Item', {
          fields: {
            text: Field.richText('Text')
          }
        })
      }
    })
  }
})
