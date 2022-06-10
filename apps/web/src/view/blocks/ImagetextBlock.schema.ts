import {Schema, type} from '@alinea/core'
import {link} from '@alinea/input.link'
import {richText} from '@alinea/input.richtext'
import {select} from '@alinea/input.select'
import {text} from '@alinea/input.text'

export const ImagetextBlockSchema = type('Image & text', {
  image: link.image('Image', {type: 'image', width: 0.75}),
  image_position: select('Image position', {
    left: 'Left',
    right: 'Right'
  }).configure({width: 0.25, initialValue: 'left'}),
  text: richText('Text'),
  button: link('Button', {
    fields: type('Fields', {
      label: text('Button label')
    })
  })
})

export type ImagetextBlockSchema = Schema.TypeOf<
  typeof ImagetextBlockSchema
> & {
  id: string
  type: 'ImagetextBlock'
}
