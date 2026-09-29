import {Config, Field} from 'alinea'
import {anchorField, iconOptions, labeledLink} from './options'

export const FeatureGrid = Config.type('Feature grid', {
  fields: {
    title: Field.text('Title', {width: 0.75}),
    label: Field.text('Label', {width: 0.25}),
    description: Field.text('Description', {multiline: true}),
    link: labeledLink('Link'),
    panel: Field.check('Panel', {
      description: 'Render inside a bordered panel with muted cards'
    }),
    image: Field.image('Image', {
      width: 0.5,
      help: 'Optional screenshot shown above the items, cropped to a banner'
    }),
    darkImage: Field.image('Dark image', {
      width: 0.5,
      help: 'Optional, shown instead when the site uses its dark theme'
    }),
    items: Field.list('Items', {
      schema: {
        Feature: Config.type('Feature', {
          fields: {
            icon: Field.select('Icon', {width: 0.5, options: iconOptions}),
            tag: Field.text('Tag', {width: 0.5}),
            title: Field.text('Title'),
            text: Field.text('Text', {multiline: true}),
            // The whole item links here, a label is optional
            link: labeledLink('Link')
          }
        })
      }
    }),
    anchor: anchorField()
  }
})
