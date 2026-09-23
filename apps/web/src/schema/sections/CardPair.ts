import {Config, Field} from 'alinea'
import {anchorField} from './options'

export const CardPair = Config.type('Card pair', {
  fields: {
    cards: Field.list('Cards', {
      schema: {
        CodeCard: Config.type('Code card', {
          fields: {
            title: Field.text('Title'),
            text: Field.text('Text', {multiline: true}),
            filename: Field.text('File name'),
            code: Field.code('Code'),
            chips: Field.list('Chips', {
              schema: {
                Item: Config.type('Item', {
                  fields: {
                    text: Field.text('Text')
                  }
                })
              }
            })
          }
        }),
        BarsCard: Config.type('Bars card', {
          fields: {
            title: Field.text('Title'),
            text: Field.text('Text', {multiline: true}),
            bars: Field.list('Bars', {
              schema: {
                Bar: Config.type('Bar', {
                  fields: {
                    name: Field.text('Name', {width: 0.4}),
                    count: Field.number('Count', {width: 0.2}),
                    size: Field.text('Size', {width: 0.2}),
                    highlight: Field.check('Highlight', {width: 0.2})
                  }
                })
              }
            }),
            footnote: Field.text('Footnote', {multiline: true})
          }
        })
      }
    }),
    attached: Field.check('Attached', {
      description: 'Continue the previous section with reduced spacing'
    }),
    anchor: anchorField()
  }
})
