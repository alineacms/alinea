import {Config, Field} from 'alinea'
import {anchorField} from './options'

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
    anchor: anchorField()
  }
})
