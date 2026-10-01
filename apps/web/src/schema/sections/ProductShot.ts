import {Config, Field} from 'alinea'
import {anchorField, iconOptions, labeledLink} from './options'

export const ProductShot = Config.type('Product shot', {
  fields: {
    image: Field.image('Image', {
      width: 0.5,
      help: 'Leave empty to show the dashboard illustration'
    }),
    darkImage: Field.image('Dark image', {
      width: 0.5,
      help: 'Optional, shown instead when the site uses its dark theme'
    }),
    features: Field.list('Features', {
      help: 'A few features shown beside the image, each linking further',
      schema: {
        Feature: Config.type('Feature', {
          fields: {
            icon: Field.select('Icon', {width: 0.5, options: iconOptions}),
            title: Field.text('Title', {width: 0.5}),
            text: Field.text('Text', {multiline: true}),
            link: labeledLink('Link'),
            image: Field.image('Image', {
              width: 0.5,
              help: 'Shown instead of the main image while the feature is hovered, in the same size'
            }),
            darkImage: Field.image('Dark image', {width: 0.5})
          }
        })
      }
    }),
    anchor: anchorField()
  }
})
