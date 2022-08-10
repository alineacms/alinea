import {Schema, type} from '@alinea/core'
import {richText} from '@alinea/input.richtext'
import {ComponentType} from 'react'

export const DemoColumnsBlockSchema = type('Columns', {
  text_left: richText('Text left'),
  text_right: richText('Text right')
})

export type DemoColumnsBlockSchema = Schema.TypeOf<
  typeof DemoColumnsBlockSchema
> & {
  id: string
  type: 'DemoColumnsBlock'
  container?: ComponentType
}
