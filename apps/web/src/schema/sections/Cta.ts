import {Config, Field} from 'alinea'
import {anchorField, labeledLink} from './options'

export const Cta = Config.type('Call to action', {
  fields: {
    title: Field.text('Title'),
    text: Field.text('Text', {multiline: true}),
    link: labeledLink('Link', 0.5),
    command: Field.text('Command', {width: 0.5}),
    background: Field.select('Background', {
      initialValue: 'gradient',
      options: {
        gradient: 'Gradient',
        surface: 'Surface'
      }
    }),
    anchor: anchorField()
  }
})
