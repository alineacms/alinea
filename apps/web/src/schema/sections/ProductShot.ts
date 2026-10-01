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
            darkImage: Field.image('Dark image', {width: 0.5}),
            zoom: Field.number('Zoom', {
              width: 1 / 3,
              minValue: 1,
              maxValue: 3,
              step: 0.1,
              help: 'Zoom into the image while hovered, eg. 1.6'
            }),
            focusX: Field.number('Zoom to x', {
              width: 1 / 3,
              minValue: 0,
              maxValue: 100,
              help: 'Percent from the left'
            }),
            focusY: Field.number('Zoom to y', {
              width: 1 / 3,
              minValue: 0,
              maxValue: 100,
              help: 'Percent from the top'
            })
          }
        })
      }
    }),
    more: labeledLink('Link below the features'),
    anchor: anchorField()
  }
})
