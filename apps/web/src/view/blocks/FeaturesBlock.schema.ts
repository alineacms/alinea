import {schema, Schema, type} from '@alinea/core'
import {list} from '@alinea/input.list'
import {richText} from '@alinea/input.richtext'
import {ComponentType} from 'react'

export const FeaturesBlockSchema = type('Features', {
  intro: richText('Intro'),
  items: list('Items', {
    schema: schema({
      Item: type('Item', {
        text: richText('Text')
      })
    })
  })
})

export type FeaturesBlockSchema = Schema.TypeOf<typeof FeaturesBlockSchema> & {
  id: string
  type: 'FeaturesBlock'
  container?: ComponentType
}
