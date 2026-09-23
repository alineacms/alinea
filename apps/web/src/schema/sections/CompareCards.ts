import {Config, Field} from 'alinea'
import {anchorField, checksField, labeledLink} from './options'

export const CompareCards = Config.type('Compare cards', {
  fields: {
    title: Field.text('Title'),
    description: Field.text('Description', {multiline: true}),
    cards: Field.list('Cards', {
      schema: {
        Card: Config.type('Card', {
          fields: {
            title: Field.text('Title', {width: 0.5}),
            badge: Field.text('Badge', {width: 0.25}),
            tone: Field.select('Tone', {
              width: 0.25,
              initialValue: 'default',
              options: {
                default: 'Default',
                accent: 'Accent',
                outline: 'Outline'
              }
            }),
            text: Field.text('Text', {multiline: true}),
            checks: checksField(),
            code: Field.code('Code'),
            link: labeledLink('Link')
          }
        })
      }
    }),
    anchor: anchorField()
  }
})
