import {Config, Field} from 'alinea'
import {anchorField, labeledLink} from './options'

export const Cta = Config.type('Call to action', {
  fields: {
    title: Field.text('Title'),
    text: Field.text('Text', {multiline: true}),
    link: labeledLink('Link', 0.5),
    command: Field.text('Command', {width: 0.5}),
    anchor: anchorField()
  }
})
