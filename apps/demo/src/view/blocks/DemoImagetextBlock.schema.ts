import {Schema, type} from '@alinea/core'
import {link} from '@alinea/input.link'
import {richText} from '@alinea/input.richtext'
import {select} from '@alinea/input.select'
import {ComponentType} from 'react'

export const DemoImagetextBlockSchema = type('Image & text', {
  image: link.image('Image', {
    type: 'image'
  }),
  image_position: select('Image position', {
    left: 'Left',
    right: 'Right'
  }),
  text: richText('Text')
})

export type DemoImagetextBlockSchema = Schema.TypeOf<
  typeof DemoImagetextBlockSchema
> & {
  id: string
  type: 'DemoImagetextBlock'
  container?: ComponentType
}
