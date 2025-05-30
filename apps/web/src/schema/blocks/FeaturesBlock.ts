import {Config, Field} from 'alinea'

export const FeaturesBlock = Config.type('Features', {
  fields: {
    items: Field.list('Items', {
      schema: {
        FeatureItem: Config.type('Item', {
          fields: {
            text: Field.richText('Text')
          }
        })
      }
    })
  }
})
