import {Config, Field} from 'alinea'

export const ListExamples = Config.document('List fields', {
  fields: {
    list: Field.list('My list field', {
      schema: {
        Text: Config.type('Text', {
          fields: {
            title: Field.text('Item title'),
            text: Field.richText('Item body text')
          }
        }),
        Image: Config.type('Image', {
          fields: {image: Field.image('Image')}
        })
      }
    })
  }
})
