import {Config, Field} from 'alinea'
import {anchorField, iconOptions} from './options'

export const FlowCards = Config.type('Flow cards', {
  fields: {
    items: Field.list('Cards', {
      schema: {
        FlowCard: Config.type('Flow card', {
          fields: {
            icon: Field.select('Icon', {width: 0.5, options: iconOptions}),
            highlight: Field.check('Highlight', {
              width: 0.5,
              description: 'Render this card inverted'
            }),
            title: Field.text('Title'),
            text: Field.text('Text', {multiline: true})
          }
        })
      }
    }),
    anchor: anchorField()
  }
})
