import {Config, Field} from 'alinea'
import {anchorField, labeledLink} from './options'

export const Callout = Config.type('Callout', {
  fields: {
    title: Field.text('Title', {width: 0.75}),
    badge: Field.text('Badge', {width: 0.25}),
    text: Field.text('Text', {multiline: true}),
    link: labeledLink('Link'),
    anchor: anchorField()
  }
})
