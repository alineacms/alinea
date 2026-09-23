import {Config, Field} from 'alinea'
import {anchorField} from './options'

export const ProductShot = Config.type('Product shot', {
  fields: {
    image: Field.image('Image', {
      help: 'Leave empty to show the dashboard illustration'
    }),
    anchor: anchorField()
  }
})
