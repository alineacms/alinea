import alinea from 'alinea'

export const FeaturesBlock = alinea.type('Features', {
  items: alinea.list('Items', {
    schema: alinea.schema({
      FeatureItem: alinea.type('Item', {
        text: alinea.richText('Text')
      })
    })
  })
})
