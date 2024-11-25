import {Config, Field} from 'alinea'

export const ImageBlock = Config.type('Image', {
  fields: {
    image: Field.image('Link', {inline: true})
  }
})
