import {Config, Field} from 'alinea'
import {anchorField, iconOptions, labeledLink} from './options'

export const FeatureDetail = Config.type('Feature detail', {
  fields: {
    icon: Field.select('Icon', {width: 0.5, options: iconOptions}),
    label: Field.text('Label', {width: 0.5}),
    title: Field.text('Title'),
    description: Field.richText('Description', {
      help: 'Bullet lists render as check marks'
    }),
    link: labeledLink('Link'),
    image: Field.image('Image', {width: 0.5}),
    darkImage: Field.image('Dark image', {
      width: 0.5,
      help: 'Optional, shown instead when the site uses its dark theme'
    }),
    imagePosition: Field.select('Image position', {
      width: 0.5,
      initialValue: 'right',
      options: {left: 'Left', right: 'Right'}
    }),
    anchor: anchorField()
  }
})
