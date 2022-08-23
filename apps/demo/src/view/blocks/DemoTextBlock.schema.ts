import {Schema, type} from '@alinea/core'
import {richText} from '@alinea/input.richtext'
import {ComponentType} from 'react'

export const DemoTextBlockSchema = type('Text', {
  text: richText('Text', {
    inline: true
  })
})

export type DemoTextBlockSchema = Schema.TypeOf<typeof DemoTextBlockSchema> & {
  id: string
  type: 'DemoTextBlock'
  container?: ComponentType
}
