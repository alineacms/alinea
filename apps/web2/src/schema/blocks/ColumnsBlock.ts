import alinea from 'alinea'

export const ColumnsBlock = alinea.type('Columns', {
  items: alinea.list('Items', {
    schema: alinea.schema({
      ColumnItem: alinea.type('Item', {
        text: alinea.richText('Text')
      })
    })
  })
})
