import {Config, Field} from 'alinea'

export const ListFields = Config.document('List fields', {
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
    }),
    listWithInitial: Field.list('My list field', {
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
      },
      initialValue: [
        {
          _type: 'Text',
          title: 'Initial item',
          text: [
            {
              _type: 'paragraph',
              content: [
                {
                  _type: 'text',
                  text: 'This is an initial item'
                }
              ]
            }
          ]
        },
        {
          _type: 'Text',
          title: 'Initial item',
          text: [
            {
              _type: 'paragraph',
              content: [
                {
                  _type: 'text',
                  text: 'This is an initial item'
                }
              ]
            }
          ]
        }
      ]
    })
  }
})
