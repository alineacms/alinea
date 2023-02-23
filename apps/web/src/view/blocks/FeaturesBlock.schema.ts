import {schema, type} from 'alinea/core'
import {list} from 'alinea/input/list'
import {richText} from 'alinea/input/richtext'

export const FeaturesBlockSchema = type('Features', {
  items: list('Items', {
    schema: schema({
      FeatureItem: type('Item', {
        text: richText('Text')
      })
    })
  })
})
